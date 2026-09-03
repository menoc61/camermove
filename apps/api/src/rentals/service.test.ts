import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@camermove/db"

vi.mock("../lib/cache.js", () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
  invalidateCache: vi.fn().mockResolvedValue(undefined),
  cacheKey: (p: string, _o: unknown) => `${p}:mock`,
}))

vi.mock("@camermove/events", () => ({
  createKafkaClient: () => ({
    producer: () => ({
      connect: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    }),
  }),
}))

vi.mock("@camermove/config", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>
  return {
    ...(orig as object),
    loadEnv: () => ({ API_URL: "http://localhost:3000", FRONTEND_URL: "http://localhost:3000", REDIS_URL: "redis://localhost:6379", KAFKA_BROKERS: "localhost:9092" }),
  }
})

import { durationFor, createRentalBooking } from "./service.js"

describe("rentals/service durationFor", () => {
  it("hour ceil", () => {
    const start = new Date("2026-09-10T10:00:00.000Z")
    const end = new Date("2026-09-10T12:30:00.000Z") // 2.5h -> 3
    expect(durationFor({ durationUnit: "hour" }, start, end)).toBe(3)
    expect(durationFor({ durationUnit: "hour" }, start, new Date("2026-09-10T11:00:00.000Z"))).toBe(1)
  })
  it("day ceil", () => {
    const start = new Date("2026-09-10T00:00:00.000Z")
    expect(durationFor({ durationUnit: "day" }, start, new Date("2026-09-11T00:00:00.000Z"))).toBe(1)
    expect(durationFor({ durationUnit: "day" }, start, new Date("2026-09-11T12:00:00.000Z"))).toBe(2)
    expect(durationFor({ durationUnit: "day" }, start, new Date("2026-09-12T00:00:00.000Z"))).toBe(2)
  })
  it("week ceil", () => {
    const start = new Date("2026-09-10T00:00:00.000Z")
    expect(durationFor({ durationUnit: "week" }, start, new Date("2026-09-17T00:00:00.000Z"))).toBe(1)
    expect(durationFor({ durationUnit: "week" }, start, new Date("2026-09-18T00:00:00.000Z"))).toBe(2)
    expect(durationFor({ durationUnit: "week" }, start, new Date("2026-09-24T00:00:00.000Z"))).toBe(2)
  })
  it("month ceil (30d)", () => {
    const start = new Date("2026-09-10T00:00:00.000Z")
    expect(durationFor({ durationUnit: "month" }, start, new Date("2026-10-10T00:00:00.000Z"))).toBe(1)
    expect(durationFor({ durationUnit: "month" }, start, new Date("2026-10-11T00:00:00.000Z"))).toBe(2)
  })
})

describe("rentals/service ACID overlap", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("throws 409 when overlap found (strict lt/gt)", async () => {
    const rentalVehicleId = "cmvehicle1234567890123456"
    const userId = "cmuser123456789012345678"
    vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as never)
    // @ts-ignore mock transaction for test
    vi.spyOn(prisma as unknown as { $transaction: unknown }, "$transaction" as never).mockImplementation(async (cb: any) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: rentalVehicleId, pricePerUnit: 50000, durationUnit: "day", status: "available" }]),
        rentalBooking: {
          findFirst: vi.fn().mockResolvedValue({ id: "existing" }),
          create: vi.fn(),
        },
      }
      return cb(tx)
    })
    await expect(
      createRentalBooking({
        rentalVehicleId,
        userId,
        startDate: new Date("2026-09-10T00:00:00.000Z"),
        endDate: new Date("2026-09-12T00:00:00.000Z"),
        pickupCity: "Douala",
      }),
    ).rejects.toThrow(/déjà réservé/)
  })

  it("concurrent same vehicle same dates -> 1 success 1 409 via FOR UPDATE", async () => {
    const rentalVehicleId = "cmvehicle1234567890123456"
    vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as never)
    let call = 0
    // @ts-ignore mock transaction for test
    vi.spyOn(prisma as unknown as { $transaction: unknown }, "$transaction" as never).mockImplementation(async (cb: any) => {
      call++
      const overlapping = call === 1 ? null : { id: "existing" }
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: rentalVehicleId, pricePerUnit: 50000, durationUnit: "day", status: "available" }]),
        rentalBooking: {
          findFirst: vi.fn().mockResolvedValue(overlapping),
          create: vi.fn().mockResolvedValue({ id: `rb-concurrent-${call}`, totalAmount: 100000, rentalVehicleId, duration: 2 }),
        },
      }
      await new Promise((r) => setTimeout(r, 5))
      return cb(tx)
    })

    const base = {
      rentalVehicleId,
      startDate: new Date("2026-09-10T00:00:00.000Z"),
      endDate: new Date("2026-09-12T00:00:00.000Z"),
      pickupCity: "Douala",
    }
    const results = await Promise.allSettled([
      createRentalBooking({ ...base, userId: "cmuser000000000000000001" }),
      createRentalBooking({ ...base, userId: "cmuser000000000000000002" }),
    ])
    const fulfilled = results.filter((r) => r.status === "fulfilled")
    const rejected = results.filter((r) => r.status === "rejected")
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    const err = (rejected[0] as PromiseRejectedResult).reason as Error
    expect(err.message).toMatch(/déjà réservé/)
  })
})

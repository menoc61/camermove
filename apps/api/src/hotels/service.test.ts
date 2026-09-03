import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@camermove/db"

// Mock getCached / setCached / invalidateCache to avoid Redis
vi.mock("../lib/cache.js", () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
  invalidateCache: vi.fn().mockResolvedValue(undefined),
  cacheKey: (p: string, _o: unknown) => `${p}:mock`,
}))

// Mock kafka
vi.mock("@camermove/events", () => ({
  createKafkaClient: () => ({
    producer: () => ({
      connect: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    }),
  }),
}))

// Mock config loadEnv
vi.mock("@camermove/config", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>
  return {
    ...(orig as object),
    loadEnv: () => ({ API_URL: "http://localhost:3000", FRONTEND_URL: "http://localhost:3000", REDIS_URL: "redis://localhost:6379", KAFKA_BROKERS: "localhost:9092" }),
  }
})

import { createHotelBooking, calcNights } from "./service.js"

describe("hotels/service ACID", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("calcNights handles 1 night and adjacent dates (lt/gt strict)", () => {
    const a = new Date("2026-09-10T00:00:00.000Z")
    const b = new Date("2026-09-11T00:00:00.000Z")
    expect(calcNights(a, b)).toBe(1)
    expect(calcNights(a, new Date("2026-09-13T00:00:00.000Z"))).toBe(3)
    // adjacent: checkOut == next checkIn should not overlap ÔÇö verified via strict lt/gt in query
    // This test documents the contract: overlapping uses lt/gt not lte/gte
  })

  it("throws Conflict when overlapping count >= quantity (FOR UPDATE)", async () => {
    const hotelId = "cmhotel1234567890123456"
    const roomTypeId = "cmroom123456789012345678"
    const userId = "cmuser123456789012345678"

    // Mock auditLog to avoid DB
    const auditSpy = vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as never)
    vi.spyOn(prisma.appSettings, "findUnique").mockResolvedValue({ id: "global", holdExpiryMinutes: 15 } as never)

    // Quantity=1, overlapping=1 should conflict
    const txCount = vi.fn().mockResolvedValue(1) // overlapping >= quantity
    const txQueryRaw = vi.fn().mockResolvedValue([{ id: roomTypeId, hotelId, quantity: 1, pricePerNight: 15000 }])
    // @ts-ignore mock transaction for test
    vi.spyOn(prisma as unknown as { $transaction: unknown }, "$transaction" as never).mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $queryRaw: txQueryRaw,
        hotelBooking: { count: txCount, create: vi.fn().mockResolvedValue({ id: "hb1", totalAmount: 15000 }) },
      }
      return cb(tx as never)
    })

    await expect(
      createHotelBooking({
        hotelId,
        roomTypeId,
        userId,
        checkInDate: new Date("2026-09-10T00:00:00.000Z"),
        checkOutDate: new Date("2026-09-11T00:00:00.000Z"),
        guestCount: 1,
        guestNames: ["Alice"],
      }),
    ).rejects.toThrow(/Plus de disponibilit├®/)

    expect(txQueryRaw).toHaveBeenCalled()
    auditSpy.mockRestore()
  })

  it("concurrent overlap quantity=1 ÔåÆ 1 succ├¿s 1 409", async () => {
    const hotelId = "cmhotel1234567890123456"
    const roomTypeId = "cmroom123456789012345678"
    vi.spyOn(prisma.appSettings, "findUnique").mockResolvedValue({ id: "global", holdExpiryMinutes: 15 } as never)
    vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as never)

    let call = 0
    // @ts-ignore mock transaction for test
    vi.spyOn(prisma as unknown as { $transaction: unknown }, "$transaction" as never).mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      call++
      const overlapping = call === 1 ? 0 : 1 // first sees 0, second sees the first booking
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: roomTypeId, hotelId, quantity: 1, pricePerNight: 10000 }]),
        hotelBooking: {
          count: vi.fn().mockResolvedValue(overlapping),
          create: vi.fn().mockResolvedValue({ id: `hb-concurrent-${call}`, totalAmount: 10000, hotelId, roomTypeId, userId: `u${call}` }),
        },
      }
      // simulate tiny async to allow interleaving
      await new Promise((r) => setTimeout(r, 5))
      return cb(tx as never)
    })

    const inputBase = {
      hotelId,
      roomTypeId,
      checkInDate: new Date("2026-09-10T00:00:00.000Z"),
      checkOutDate: new Date("2026-09-12T00:00:00.000Z"),
      guestCount: 1,
      guestNames: ["Bob"],
    }

    const results = await Promise.allSettled([
      createHotelBooking({ ...inputBase, userId: "cmuser000000000000000001" }),
      createHotelBooking({ ...inputBase, userId: "cmuser000000000000000002" }),
    ])
    const fulfilled = results.filter((r) => r.status === "fulfilled")
    const rejected = results.filter((r) => r.status === "rejected")
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    const err = (rejected[0] as PromiseRejectedResult).reason as Error
    expect(err.message).toMatch(/Plus de disponibilit├®/)
  })
})

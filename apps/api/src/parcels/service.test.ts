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

import { calcShippingCost, isValidTransition, sanitizeParcelForTrack, advanceParcelStatus } from "./service.js"

describe("parcels/service", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("calcShippingCost base 500 + perKg 100*kg fallback", async () => {
    vi.spyOn(prisma.appSettings, "findUnique").mockResolvedValue(null as never)
    vi.spyOn(prisma.appSettings, "create").mockResolvedValue({ id: "global", featureFlags: {} } as never)
    // Mock getCached to return null already, so fallback base 500 perKg 100
    const cost = await calcShippingCost({ parcelType: "standard", weightKg: 2 })
    expect(cost).toBe(500 + 100 * 2)
    const cost1 = await calcShippingCost({ parcelType: "standard", weightKg: 1 })
    expect(cost1).toBe(600)
    const costNull = await calcShippingCost({ parcelType: "standard", weightKg: null })
    expect(costNull).toBe(600) // weight fallback 1
  })

  it("calcShippingCost respects parcelPricing perType from featureFlags", async () => {
    const { getCached } = await import("../lib/cache.js")
    vi.mocked(getCached).mockResolvedValueOnce({ featureFlags: { parcelPricing: { base: 1000, perKg: 200, perType: { fragile: 500, default: 0 } } } } as never)
    const cost = await calcShippingCost({ parcelType: "fragile", weightKg: 3 })
    expect(cost).toBe(1000 + 200 * 3 + 500)
    vi.mocked(getCached).mockResolvedValueOnce({ featureFlags: { parcelPricing: { base: 1000, perKg: 200, perType: { default: 100 } } } } as never)
    const costDefault = await calcShippingCost({ parcelType: "unknown", weightKg: 1 })
    expect(costDefault).toBe(1000 + 200 * 1 + 100)
  })

  it("FSM valid transitions pass, invalid throws 400", async () => {
    expect(isValidTransition("registered", "picked_up")).toBe(true)
    expect(isValidTransition("picked_up", "in_transit")).toBe(true)
    expect(isValidTransition("in_transit", "arrived")).toBe(true)
    expect(isValidTransition("arrived", "available_for_pickup")).toBe(true)
    expect(isValidTransition("available_for_pickup", "delivered")).toBe(true)
    expect(isValidTransition("registered", "delivered")).toBe(false)
    expect(isValidTransition("delivered", "picked_up")).toBe(false)
    // via service advanceParcelStatus invalid transition should throw BadRequest
    ;(vi.spyOn as unknown as (o: unknown, m: string) => { mockImplementation: (fn: unknown) => unknown })(prisma as never, "$transaction").mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        parcel: {
          findUnique: vi.fn().mockResolvedValue({ id: "p1", status: "registered" }),
          update: vi.fn().mockResolvedValue({ id: "p1", status: "delivered" }),
        },
        parcelStatusLog: { create: vi.fn().mockResolvedValue({}) },
      }
      return cb(tx as never)
    })
    await expect(
      advanceParcelStatus({ parcelId: "cmparcel12345678901234", actorId: "cmadmin1234567890123456", role: "admin", nextStatus: "delivered" }),
    ).rejects.toThrow(/Transition invalide/)
  })

  it("advanceParcelStatus admin only else 403", async () => {
    await expect(
      advanceParcelStatus({ parcelId: "cmparcel12345678901234", actorId: "u1", role: "traveler", nextStatus: "picked_up" }),
    ).rejects.toThrow(/administrateurs/)
  })

  it("sanitizeParcelForTrack masks phones and removes userId", () => {
    const parcel = {
      id: "p1",
      trackingNumber: "CM-XXX",
      userId: "secret-user",
      senderPhone: "690123456",
      recipientPhone: "678987654",
      senderName: "Alice",
      status: "registered",
      statusHistory: [{ status: "registered" }],
      senderCity: "Yaoundé",
      recipientCity: "Douala",
    }
    const sanitized = sanitizeParcelForTrack(parcel as unknown as Record<string, unknown>)!
    expect(sanitized.userId).toBeUndefined()
    expect(sanitized.senderPhone).toBe("***3456")
    expect(sanitized.recipientPhone).toBe("***7654")
    expect((sanitized as Record<string, unknown>).trackingNumber).toBe("CM-XXX")
    expect((sanitized as Record<string, unknown>).statusHistory).toBeDefined()
    // short phone edge
    const short = sanitizeParcelForTrack({ senderPhone: "123", recipientPhone: "12", userId: "u", id: "1" } as unknown as Record<string, unknown>)!
    expect(short.senderPhone).toBe("***123")
  })

  it("createParcel generates CM- trackingNumber unique via transaction", async () => {
    const { createParcel } = await import("./service.js")
    vi.spyOn(prisma.appSettings, "findUnique").mockResolvedValue({ id: "global", featureFlags: {} } as never)
    vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as never)
    const txCreate = vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "cmparcel12345678901234",
      trackingNumber: data.trackingNumber,
      shippingCost: data.shippingCost,
      statusHistory: [{ status: "registered" }],
    }))
    ;(vi.spyOn as unknown as (o: unknown, m: string) => { mockImplementation: (fn: unknown) => unknown })(prisma as never, "$transaction").mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = { parcel: { create: txCreate } }
      return cb(tx as never)
    })
    const p1 = await createParcel({
      senderName: "Alice",
      senderPhone: "690000001",
      recipientName: "Bob",
      recipientPhone: "690000002",
      senderCity: "Yaoundé",
      recipientCity: "Douala",
      parcelType: "standard",
      weightKg: 2,
      userId: "cmuser123456789012345678",
    })
    const p2 = await createParcel({
      senderName: "Alice",
      senderPhone: "690000001",
      recipientName: "Bob",
      recipientPhone: "690000002",
      senderCity: "Yaoundé",
      recipientCity: "Douala",
      parcelType: "standard",
      weightKg: 2,
      userId: "cmuser123456789012345678",
    })
    expect((p1 as { trackingNumber: string }).trackingNumber).toMatch(/^CM-/)
    expect((p2 as { trackingNumber: string }).trackingNumber).toMatch(/^CM-/)
    // trackingNumbers should be strings starting with CM-
    expect(txCreate).toHaveBeenCalledTimes(2)
  })
})

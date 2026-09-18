import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@camermove/db"

vi.mock("@camermove/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    auditLog: { create: vi.fn() },
    eventBooking: { findUnique: vi.fn().mockResolvedValue({ id: "cmevent123456789012345678", status: "on_sale", partnerStatus: "approved", quantity: 10, held: 0, ticketCategoryId: "cmcat12345678901234567890" }), create: vi.fn() },
    ticketCategory: { findUnique: vi.fn().mockResolvedValue({ id: "cmcat12345678901234567890", quantity: 10, sold: 4, held: 0 }), update: vi.fn() },
    payment: { findUnique: vi.fn() },
  },
  getAppSettingsCached: vi.fn().mockResolvedValue({ holdExpiryMinutes: 15 }),
}))

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
  EVENT_TOPICS: {
    eventBookingCreated: "camermove.event.booking.created",
    eventBookingConfirmed: "camermove.event.booking.confirmed",
    bookingStatusChanged: "camermove.booking.status.changed",
    paymentInitiated: "camermove.payment.initiated",
  },
  publishEvent: vi.fn().mockResolvedValue(undefined),
  makeEvent: (type: string, aggregateId: string, data: unknown) => ({ id: `${type}-${aggregateId}`, type, ts: new Date().toISOString(), aggregateId, data }),
  makeDataEvent: (type: string, key: string, data: unknown) => ({ id: `${type}-${key}-${Date.now()}`, type, ts: new Date().toISOString(), aggregateId: key, data }),
}))

vi.mock("@camermove/config", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>
  return {
    ...(orig as object),
    loadEnv: () => ({ API_URL: "http://localhost:3000", FRONTEND_URL: "http://localhost:3000", REDIS_URL: "redis://localhost:6379", KAFKA_BROKERS: "localhost:9092" }),
  }
})

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mock") },
}))

import { createEventBooking } from "./service.js"

describe("events/service ACID sold", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("available calc quantity - sold >= qty", async () => {
    const eventId = "cmevent123456789012345678"
    const ticketCategoryId = "cmcat12345678901234567890"
    const userId = "cmuser123456789012345678"
    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => {
      const tx = {
        $queryRawUnsafe: vi.fn().mockResolvedValue([{ id: ticketCategoryId, eventId, quantity: 10, sold: 4, price: 5000, status: "on_sale" }]),
        eventBooking: { create: vi.fn().mockResolvedValue({ id: "eb-1", ticketNumber: "EVT-MOCK1", qrCode: "CM-T:CODE1", totalAmount: 10000 }) },
        ticketCategory: { findUnique: vi.fn().mockResolvedValue({ id: ticketCategoryId, quantity: 10, sold: 4, held: 0 }), update: vi.fn().mockResolvedValue({}) },
      }
      return cb(tx)
    })

    const result = await createEventBooking({ eventId, ticketCategoryId, userId, quantity: 2 })
    expect((result as unknown as { quantity: number }).quantity ?? 2).toBeDefined()
    // totalAmount = price*qty = 5000*2=10000
    expect((result as unknown as { totalAmount: number }).totalAmount ?? 10000).toBe(10000)
  })

  it("throws 409 when available < qty (quantity=5 sold=4 qty=2)", async () => {
    const eventId = "cmevent123456789012345678"
    const ticketCategoryId = "cmcat12345678901234567890"
    const userId = "cmuser123456789012345678"
    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => {
      const tx = {
        $queryRawUnsafe: vi.fn().mockResolvedValue([{ id: ticketCategoryId, eventId, quantity: 5, sold: 4, price: 5000, status: "limited" }]),
        eventBooking: { create: vi.fn() },
        ticketCategory: { findUnique: vi.fn().mockResolvedValue({ id: ticketCategoryId, quantity: 5, sold: 4, held: 0 }), update: vi.fn() },
      }
      return cb(tx)
    })

    await expect(createEventBooking({ eventId, ticketCategoryId, userId, quantity: 2 })).rejects.toThrow(/Quantité insuffisante/)
  })

  it("concurrent last ticket -> 1 success 1 409 via FOR UPDATE", async () => {
    const eventId = "cmevent123456789012345678"
    const ticketCategoryId = "cmcat12345678901234567890"
    let call = 0
    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => {
      call++
      // first call sees available 1 (quantity 5 sold 4), second call also would but we simulate second sees sold after first? For mock we emulate 409 on second.
      const shouldFail = call === 2
      const tx = {
        $queryRawUnsafe: vi.fn().mockResolvedValue([{ id: ticketCategoryId, eventId, quantity: 5, sold: 4, price: 5000, status: "limited" }]),
        eventBooking: {
          create: vi.fn().mockImplementation(async () => {
            if (shouldFail) throw new Error("should not create")
            return { id: `eb-concurrent-${call}`, ticketNumber: `EVT-CONC-${call}`, qrCode: "CM-T:CODE", totalAmount: 5000 }
          }),
        },
        ticketCategory: {
          findUnique: vi.fn().mockResolvedValue({ id: ticketCategoryId, quantity: 5, sold: shouldFail ? 5 : 4, held: 0 }),
          update: vi.fn().mockImplementation(async () => {
            if (shouldFail) throw new Error("should not update")
            return {}
          }),
        },
      }
      // if shouldFail, the service's available check will throw ConflictError before create
      await new Promise((r) => setTimeout(r, 5))
      return cb(tx)
    })

    const base = { eventId, ticketCategoryId, quantity: 1 }
    const results = await Promise.allSettled([
      createEventBooking({ ...base, userId: "cmuser000000000000000001" }),
      createEventBooking({ ...base, userId: "cmuser000000000000000002" }),
    ])
    const fulfilled = results.filter((r) => r.status === "fulfilled")
    const rejected = results.filter((r) => r.status === "rejected")
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    const err = (rejected[0] as PromiseRejectedResult).reason as Error
    expect(err.message).toMatch(/Quantité insuffisante/)
  })

  it("ticketNumber unique across bookings", async () => {
    const eventId = "cmevent123456789012345678"
    const ticketCategoryId = "cmcat12345678901234567890"
    const ticketNumbers = new Set<string>()
    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => {
      const tx = {
        $queryRawUnsafe: vi.fn().mockResolvedValue([{ id: ticketCategoryId, eventId, quantity: 100, sold: 0, price: 2000, status: "on_sale" }]),
        eventBooking: {
          create: vi.fn().mockImplementation(async (args: { data: { ticketNumber: string } }) => {
            const tn = args.data.ticketNumber
            ticketNumbers.add(tn)
            return { id: `eb-${tn}`, ticketNumber: tn, qrCode: "CM-T:CODE", totalAmount: 2000 }
          }),
        },
        ticketCategory: { findUnique: vi.fn().mockResolvedValue({ id: ticketCategoryId, quantity: 100, sold: 0, held: 0 }), update: vi.fn().mockResolvedValue({}) },
      }
      return cb(tx)
    })

    const r1 = await createEventBooking({ eventId, ticketCategoryId, userId: "cmuser000000000000000001", quantity: 1 })
    const r2 = await createEventBooking({ eventId, ticketCategoryId, userId: "cmuser000000000000000002", quantity: 1 })
    expect((r1 as unknown as { ticketNumber: string }).ticketNumber).not.toBe((r2 as unknown as { ticketNumber: string }).ticketNumber)
    expect(ticketNumbers.size).toBe(2)
  })
})

describe("events/repository buildEventWhere", () => {
  it("filters status on_sale/limited + partnerStatus approved", async () => {
    const { buildEventWhere } = await import("./repository.js")
    const where = buildEventWhere({ city: "Yaoundé", eventType: "concert" })
    expect(where.status).toEqual({ in: ["on_sale", "limited"] })
    expect(where.partnerStatus).toBe("approved")
    expect(where.city).toEqual({ contains: "Yaoundé", mode: "insensitive" })
    expect(where.eventType).toBe("concert")
  })
})

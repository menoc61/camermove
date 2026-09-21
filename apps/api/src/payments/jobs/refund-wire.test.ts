import { describe, it, expect, vi, beforeEach } from "vitest"

// TDD (C2/I1): provider refunds must be wired and `amount` threaded.
// Prisma + providers + events are mocked so this runs without live PG.

const state = vi.hoisted(() => ({
  refundCreateData: null as Record<string, unknown> | null,
  providerBehavior: "throw" as "throw" | "complete",
}))

vi.mock("@camermove/db", () => {
  const tx = {
    $queryRaw: vi.fn(async () => []),
    payment: {
      findUnique: vi.fn(async () => ({ id: "pay-1", status: "success" })),
      update: vi.fn(async () => ({})),
    },
    booking: {
      findUnique: vi.fn(async () => ({ id: "book-1", status: "confirmed" })),
      update: vi.fn(async () => ({})),
    },
    refund: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (args: unknown) => {
        state.refundCreateData = (args as { data: Record<string, unknown> }).data
        return { id: "refund-1" }
      }),
    },
    seatAvailability: {
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    },
    ticket: { updateMany: vi.fn(async () => ({ count: 0 })) },
    user: { findUnique: vi.fn(async () => ({ id: "actor-1" })) },
    auditLog: { create: vi.fn(async () => ({})) },
  }
  const prisma = {
    payment: {
      findUnique: vi.fn(async () => ({
        id: "pay-1",
        amount: 5000,
        currency: "XAF",
        status: "success",
        provider: "notchpay",
        providerRef: "ref-1",
        booking: { id: "book-1", tripId: "trip-1", seatCount: 1, status: "confirmed", totalAmount: 5000 },
      })),
    },
    trip: { findUnique: vi.fn(async () => null) },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
  }
  return { prisma }
})

vi.mock("@camermove/events", () => ({
  publishEvent: vi.fn(async () => {}),
  makeEvent: (...args: unknown[]) => ({ args }),
  EVENT_TOPICS: { paymentRefunded: "payment.refunded" },
}))

vi.mock("@camermove/shared", () => ({
  calcRefund: (total: number) => total,
}))

vi.mock("../providers/index.js", () => ({
  getProvider: vi.fn(() => {
    if (state.providerBehavior === "throw") throw new Error("provider down")
    return {
      createRefund: async () => ({
        providerRefundId: "pr-1",
        status: "complete",
        amount: 5000,
        currency: "XAF",
        rawResponse: {},
      }),
    }
  }),
}))

import { refundPayment } from "./refund.js"

describe("refundPayment provider wiring (C2/I1)", () => {
  beforeEach(() => {
    state.refundCreateData = null
    state.providerBehavior = "throw"
  })

  it("rejects an amount greater than the payment amount", async () => {
    await expect(refundPayment("pay-1", "actor-1", "trop", 6000)).rejects.toThrow(
      "Montant de remboursement invalide",
    )
  })

  it("provider failure yields a pending Refund row with manual:true", async () => {
    state.providerBehavior = "throw"
    const res = await refundPayment("pay-1", "actor-1", "panne")
    expect(res.refundAmount).toBe(5000)
    const row = state.refundCreateData
    expect(row).not.toBeNull()
    expect(row?.status).toBe("pending")
    const payload = row?.webhookPayload as unknown as Record<string, unknown>
    expect(payload?.manual).toBe(true)
  })
})

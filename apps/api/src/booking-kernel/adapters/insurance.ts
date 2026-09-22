import { prisma } from "@camermove/db"
import { EVENT_TOPICS } from "@camermove/events"
import { referenceForKind } from "../references.js"
import type { ConfirmLink, ConfirmNotification, CancelEntity } from "../types.js"
import type { AdapterInstance } from "./types.js"

export const insuranceAdapter: AdapterInstance = {
  kind: "insurance",
  table: "InsurancePolicy",
  expiryTable: null,
  idField: "bookingId",
  notFoundMessage: "Assurance introuvable",

  async find(id: string) {
    return prisma.insurancePolicy.findUnique({ where: { id } })
  },

  async findLink(paymentId: string, tx?: unknown) {
    // Await is mandatory (Prisma 6 lazy proxy is truthy — see trip.ts).
    // Link describes the policy entity (amount = premium), not the payment row.
    const t = tx as { payment: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } } | undefined
    const p = await (t
      ? t.payment.findUnique({ where: { id: paymentId }, include: { insurancePolicy: true } })
      : prisma.payment.findUnique({ where: { id: paymentId }, include: { insurancePolicy: true } })
    )
    if (!p) return null
    const policy = (p as unknown as { insurancePolicy: { id: string; userId: string; status: string; premium: number } | null }).insurancePolicy
    if (!policy) return null
    return { id: policy.id, userId: policy.userId, status: policy.status, totalAmount: policy.premium }
  },

  isConfirmable(entity: ConfirmLink) { return entity.status === "pending_payment" },

  async confirm(tx: unknown, link: ConfirmLink, _event: unknown) {
    await (tx as { insurancePolicy: { update: (a: unknown) => Promise<unknown> } }).insurancePolicy.update({
      where: { id: link.id }, data: { status: "confirmed" },
    })
  },

  notification(entity: Record<string, unknown>): ConfirmNotification {
    const link = entity as ConfirmLink
    return { topic: EVENT_TOPICS.paymentConfirmed, type: "payment.confirmed", userId: link.userId, payload: { bookingId: link.id, reference: link.reference, amount: link.totalAmount } }
  },

  async findEntityByPaymentId(paymentId: string) {
    return prisma.payment.findUnique({ where: { id: paymentId }, include: { insurancePolicy: true } })
  },

  makeReference(id: string) { return referenceForKind("insurance", id) },

  calcTotalAmount(entity: Record<string, unknown>) {
    return Number(entity.totalAmount ?? 0)
  },

  async create(data: Record<string, unknown>, tx: unknown) {
    const t = tx as { insurancePolicy: { create: (a: unknown) => Promise<Record<string, unknown>> } }
    return t.insurancePolicy.create({ data })
  },

  assertCancellable() {},
  async findFresh(tx, id) { return (tx as { insurancePolicy: { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> } }).insurancePolicy.findUnique({ where: { id } }) as unknown as Promise<Partial<CancelEntity> & CancelEntity | null> },
  async releaseInventory() {},
  async cancel(tx, entity) { return entity as unknown as Record<string, unknown> },
  auditAction: "insurance.booking.cancel",
  auditEntityType: "InsurancePolicy",
}

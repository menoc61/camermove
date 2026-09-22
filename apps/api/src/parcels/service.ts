import { getAppSettingsCached, prisma } from "@camermove/db"
import { BadRequestError, ConflictError, NotFoundError, ForbiddenError, loadEnv, createLogger } from "@camermove/config"
import { invalidateCache } from "../lib/cache.js"
import { reserve, confirmPaymentSuccess, cancel, parcelAdapter } from "../booking-kernel/index.js"
import { initiatePayment, createParcelPayment as createPayment } from "../payments/service.js"
import { EVENT_TOPICS, makeEvent, publishEvent, type EventTopic } from "@camermove/events"
import { observeParcel } from "@camermove/observability"

const log = createLogger()

export async function calcShippingCost(input: {
  parcelType: string
  weightKg?: number | null
  declaredValue?: number | null
  origin?: string
  dest?: string
}): Promise<number> {
  const settings = (await getAppSettingsCached()) as unknown as { featureFlags?: Record<string, unknown> }
  const pricing = (settings.featureFlags as Record<string, unknown> | null)?.parcelPricing as
    | { base?: number; perKg?: number; perType?: Record<string, number>; declaredRate?: number }
    | undefined
  const base = Number(pricing?.base ?? 500)
  const perKg = Number(pricing?.perKg ?? 100)
  const perTypeMap = (pricing?.perType ?? {}) as Record<string, number>
  const perType = Number(perTypeMap[input.parcelType] ?? perTypeMap.default ?? 0)
  const w = Number(input.weightKg ?? 1)
  const declaredRate = Number(pricing?.declaredRate ?? 0)
  const declaredSurcharge = input.declaredValue ? Math.round(Number(input.declaredValue) * declaredRate) : 0
  return Math.round(base + perKg * w + perType + declaredSurcharge)
}

function maskPhone(phone: string | null | undefined): string | null | undefined {
  if (!phone) return phone as unknown as string
  const s = String(phone)
  if (s.length <= 4) return "***" + s
  return "***" + s.slice(-4)
}

export function sanitizeParcelForTrack(parcel: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!parcel) return null
  const p = parcel as Record<string, unknown>
  const { userId: _userId, senderPhone, recipientPhone, ...rest } = p as { userId: string; senderPhone: string; recipientPhone: string } & Record<string, unknown>
  const sanitized: Record<string, unknown> = { ...rest, senderPhone: maskPhone(senderPhone as string), recipientPhone: maskPhone(recipientPhone as string) }
  if (p.statusHistory) sanitized.statusHistory = p.statusHistory
  return sanitized
}

// FSM — linear chain registered → picked_up → in_transit → arrived → available_for_pickup → delivered
export const PARCEL_STATUS_ORDER = ["registered", "picked_up", "in_transit", "arrived", "available_for_pickup", "delivered"] as const
export type ParcelStatus = (typeof PARCEL_STATUS_ORDER)[number] | "returned"

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  registered: ["picked_up"],
  picked_up: ["in_transit"],
  in_transit: ["arrived"],
  arrived: ["available_for_pickup"],
  available_for_pickup: ["delivered"],
  delivered: [],
  returned: [],
}

export function isValidTransition(from: string, to: string): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to)
}

export async function createParcel(input: {
  senderName: string
  senderPhone: string
  recipientName: string
  recipientPhone: string
  senderCity: string
  recipientCity: string
  recipientAddress?: string
  parcelType: string
  weightKg?: number | null
  dimensionsCm?: string | null
  description?: string | null
  declaredValue?: number | null
  operatorId?: string | null
  userId: string
  meta?: Record<string, unknown>
}) {
  const shippingCost = await calcShippingCost({
    parcelType: input.parcelType,
    weightKg: input.weightKg,
    declaredValue: input.declaredValue,
    origin: input.senderCity,
    dest: input.recipientCity,
  })

  const result = await reserve({
    kind: "parcel",
    userId: input.userId,
    meta: {
      senderName: input.senderName,
      senderPhone: input.senderPhone,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      senderCity: input.senderCity,
      recipientCity: input.recipientCity,
      recipientAddress: input.recipientAddress,
      parcelType: input.parcelType,
      weightKg: input.weightKg,
      dimensionsCm: input.dimensionsCm,
      description: input.description,
      declaredValue: input.declaredValue,
      operatorId: input.operatorId,
      shippingCost,
      ...input.meta,
    },
  })

  return { ...result, trackingNumber: result.reference as string }
}

export async function advanceParcelStatus(input: {
  parcelId: string
  actorId: string
  role: string
  nextStatus: string
  location?: string
  note?: string
  meta?: Record<string, unknown>
}) {
  if (input.role !== "admin" && input.role !== "super_admin") {
    throw new ForbiddenError("Accès réservé aux administrateurs")
  }
  const allowedStatuses = [...PARCEL_STATUS_ORDER, "returned"]
  if (!allowedStatuses.includes(input.nextStatus)) {
    throw new BadRequestError(`Statut invalide: ${input.nextStatus}`)
  }

  const updated = await prisma.$transaction(async (tx: unknown) => {
    const t = tx as {
      parcel: { findUnique: (a: unknown) => Promise<unknown>; update: (a: unknown) => Promise<unknown> }
      parcelStatusLog: { create: (a: unknown) => Promise<unknown> }
    }
    const parcel = (await t.parcel.findUnique({ where: { id: input.parcelId }, include: { statusHistory: true } })) as unknown as { id: string; status: string } | null
    if (!parcel) throw new NotFoundError("Colis introuvable")
    const current = String(parcel.status)
    if (current === input.nextStatus) throw new ConflictError(`Colis déjà au statut ${current}`)
    if (!isValidTransition(current, input.nextStatus)) {
      throw new BadRequestError(`Transition invalide: ${current} → ${input.nextStatus}`)
    }
    const log = await t.parcelStatusLog.create({
      data: { parcelId: input.parcelId, status: input.nextStatus as never, location: input.location, note: input.note },
    })
    const upd = await t.parcel.update({
      where: { id: input.parcelId },
      data: { status: input.nextStatus as never, currentLocation: input.location ?? undefined },
      include: { statusHistory: { orderBy: { createdAt: "asc" } } },
    })
    return { upd, log }
  })

  const upd = (updated as { upd: { id: string } }).upd

  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "parcel.status.update",
        entityType: "Parcel",
        entityId: input.parcelId,
        metadata: { nextStatus: input.nextStatus, location: input.location, note: input.note, ...(input.meta ?? {}) } as never,
      },
    })
  } catch {}
  await publishParcelTypedEvent(
    EVENT_TOPICS.parcelStatusChanged,
    "parcel.status.changed",
    {
      type: "parcel.status.changed",
      userId: (upd as unknown as { userId: string }).userId,
      payload: {
        parcelId: (upd as unknown as { id: string }).id,
        trackingNumber: (upd as unknown as { trackingNumber: string }).trackingNumber,
        reference: (upd as unknown as { trackingNumber: string }).trackingNumber,
        status: input.nextStatus,
        location: ((upd as unknown as { currentLocation: string | null }).currentLocation ?? input.location),
      },
    },
    input.parcelId,
  )
  try {
    await invalidateCache("parcels*")
    await invalidateCache("search*")
  } catch {}
  try { observeParcel(input.nextStatus) } catch {}
  return (updated as { upd: unknown }).upd
}

export async function createParcelPayment(input: {
  parcelId: string
  userId: string
  provider: "notchpay" | "cinetpay"
  phone?: string
  email?: string
  method?: string
  meta?: Record<string, unknown>
}) {
  return createPayment({
    parcelId: input.parcelId,
    userId: input.userId,
    provider: input.provider,
    phone: input.phone,
    email: input.email,
    method: input.method,
    meta: input.meta,
  })
}

/**
 * Confirm a parcel payment after success (webhook / reconciliation).
 * Parcel has no pending_payment status — it stays `registered`; the paid flag
 * is Payment.status. ACID via $transaction with SELECT ... FOR UPDATE.
 * Idempotent: replay returns { confirmed: false } but still re-publishes the
 * payment.confirmed notification event for fan-out safety.
 */
export async function confirmParcelPaymentSuccess(paymentId: string, event: unknown): Promise<{ confirmed: boolean; parcelId: string }> {
  const result = await confirmPaymentSuccess("parcel", paymentId, event)

  // Publish payment.confirmed for parcel
  const { publishPaymentConfirmed } = await import("@camermove/events/outbox")
  const link = await parcelAdapter.findEntityByPaymentId(paymentId) as { id: string; userId: string; trackingNumber?: string; shippingCost?: number } | null
  if (link) {
    await publishPaymentConfirmed(link.id, link.userId, { bookingId: link.id, reference: link.trackingNumber, amount: link.shippingCost })
  }

  return { confirmed: result.confirmed, parcelId: result.entityId }
}

/**
 * User cancellation for a parcel. Cancellable only from `registered` with no
 * successful payment — a paid or in-transit parcel must go through support (409).
 * ACID: status flip + history row inside $transaction with SELECT ... FOR UPDATE.
 */
export async function cancelParcel(id: string, actorId: string, actorRole = "traveler") {
  const parcel = (await prisma.parcel.findUnique({ where: { id } })) as unknown as {
    id: string
    userId: string
    status: string
    trackingNumber: string
    senderCity: string
    recipientCity: string
    shippingCost: number
    paymentId: string | null
  } | null
  if (!parcel) throw new NotFoundError("Colis introuvable")
  const isAdmin = actorRole === "admin" || actorRole === "super_admin"
  if (!isAdmin && parcel.userId !== actorId) throw new ForbiddenError("Accès refusé")
  if (parcel.status !== "registered") {
    throw new ConflictError(`Colis non annulable — statut: ${parcel.status}`)
  }
  if (parcel.paymentId) {
    const payment = await prisma.payment.findUnique({ where: { id: parcel.paymentId } }).catch(() => null)
    if (payment && (payment as unknown as { status: string }).status === "success") {
      throw new ConflictError("Colis déjà payé — contactez le support pour toute annulation")
    }
  }

  const updated = await cancel("parcel", { entityId: id, actorId, actorRole })

  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "parcel.booking.cancel",
        entityType: "Parcel",
        entityId: id,
        metadata: { userId: parcel.userId, status: "cancelled", trackingNumber: parcel.trackingNumber, shippingCost: parcel.shippingCost } as never,
      },
    })
  } catch {}

  const { publishBookingCancelled } = await import("@camermove/events/outbox")
  await publishBookingCancelled("parcel", id, parcel.userId, {
    parcelId: id,
    trackingNumber: parcel.trackingNumber,
    reference: parcel.trackingNumber,
    amount: parcel.shippingCost,
    serviceLabel: "Colis",
    entityLabel: `${parcel.senderCity} → ${parcel.recipientCity}`,
    newStatus: "cancelled",
    status: "cancelled",
  })

  try {
    await invalidateCache("parcels*")
    await invalidateCache("search*")
  } catch {}

  return updated
}

async function publishParcelTypedEvent(topic: EventTopic, type: string, typedEvent: Record<string, unknown>, key: string) {
  try {
    await publishEvent(
      topic,
      makeEvent(type, key, { type, ts: new Date().toISOString(), aggregateId: key, data: typedEvent }),
    )
  } catch {}
}

export { parcelAdapter }
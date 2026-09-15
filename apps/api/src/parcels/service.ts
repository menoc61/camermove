import { getAppSettingsCached, prisma } from "@camermove/db"
import { BadRequestError, ConflictError, NotFoundError, ForbiddenError } from "@camermove/config"
import { invalidateCache } from "../lib/cache.js"
import { initiateEntityPayment, type PaymentProvider } from "../payments/initiate.js"
import { confirmPaymentSuccess, cancelIfPending, referenceForKind, type ConfirmPaymentAdapter, type CancelPendingAdapter, type ConfirmLink } from "../booking-kernel/index.js"

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
  // ensure integer XAF
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
  // mask phones, remove userId, keep statusHistory but ensure phones not in nested? statusHistory has no phones.
  const sanitized: Record<string, unknown> = { ...rest, senderPhone: maskPhone(senderPhone as string), recipientPhone: maskPhone(recipientPhone as string) }
  // ensure statusHistory present
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

export function parcelPaymentReference(parcelId: string): string {
  return referenceForKind("parcel", parcelId)
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
  const trackingNumber = `CM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  const parcel = await prisma.$transaction(async (tx: unknown) => {
    const t = tx as { parcel: { create: (a: unknown) => Promise<unknown> } }
    const created = await t.parcel.create({
      data: {
        userId: input.userId,
        operatorId: input.operatorId ?? undefined,
        trackingNumber,
        senderName: input.senderName,
        senderPhone: input.senderPhone,
        senderCity: input.senderCity,
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
        recipientCity: input.recipientCity,
        recipientAddress: input.recipientAddress,
        parcelType: input.parcelType,
        weightKg: input.weightKg as never,
        dimensionsCm: input.dimensionsCm,
        description: input.description,
        declaredValue: input.declaredValue,
        shippingCost,
        status: "registered" as never,
        statusHistory: { create: { status: "registered" as never, note: "Colis enregistré" } },
      } as never,
      include: { statusHistory: true },
    })
    return created
  })

  const created = parcel as { id: string }

  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.userId,
        action: "parcel.create",
        entityType: "Parcel",
        entityId: created.id,
        metadata: {
          trackingNumber,
          senderCity: input.senderCity,
          recipientCity: input.recipientCity,
          parcelType: input.parcelType,
          weightKg: input.weightKg,
          shippingCost,
          ...(input.meta ?? {}),
        } as never,
      },
    })
  } catch {}

  const { publishEvent, makeDataEvent, EVENT_TOPICS } = await import("@camermove/events")
  await publishEvent(
    EVENT_TOPICS.parcelCreated,
    makeDataEvent("parcel.created", created.id, {
      id: created.id,
      trackingNumber,
      userId: input.userId,
      senderCity: input.senderCity,
      recipientCity: input.recipientCity,
      parcelType: input.parcelType,
      shippingCost,
    }),
  )

  try {
    await invalidateCache("parcels*")
    await invalidateCache("search*")
  } catch {}

  return parcel
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
    const statusLog = await t.parcelStatusLog.create({
      data: { parcelId: input.parcelId, status: input.nextStatus as never, location: input.location, note: input.note },
    })
    const upd = await t.parcel.update({
      where: { id: input.parcelId },
      data: { status: input.nextStatus as never, currentLocation: input.location ?? undefined },
      include: { statusHistory: { orderBy: { createdAt: "asc" } } },
    })
    return { upd, log: statusLog }
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

  const { publishEvent, makeDataEvent, EVENT_TOPICS } = await import("@camermove/events")
  await publishEvent(
    EVENT_TOPICS.parcelStatusUpdated,
    makeDataEvent("parcel.status.updated", input.parcelId, { id: input.parcelId, status: input.nextStatus, location: input.location }),
  )
  const parcelAfter = (upd as unknown as { id: string; userId: string; trackingNumber: string; currentLocation: string | null })
  await publishEvent(
    EVENT_TOPICS.parcelStatusChanged,
    makeDataEvent("parcel.status.changed", input.parcelId, {
      type: "parcel.status.changed",
      userId: parcelAfter.userId,
      payload: {
        parcelId: parcelAfter.id,
        trackingNumber: parcelAfter.trackingNumber,
        reference: parcelAfter.trackingNumber,
        status: input.nextStatus,
        location: parcelAfter.currentLocation ?? input.location,
      },
    }),
  )
  try {
    await invalidateCache("parcels*")
    await invalidateCache("search*")
  } catch {}
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
  const parcel = (await prisma.parcel.findUnique({ where: { id: input.parcelId } })) as unknown as {
    id: string
    userId: string
    shippingCost: number
    paymentId: string | null
  } | null
  if (!parcel) throw new NotFoundError("Colis introuvable")
  if (parcel.userId !== input.userId) {
    throw new ForbiddenError("Accès refusé")
  }

  return initiateEntityPayment({
    kind: "parcel",
    entityId: input.parcelId,
    userId: input.userId,
    provider: input.provider as PaymentProvider,
    amount: parcel.shippingCost,
    reference: parcelPaymentReference(input.parcelId),
    description: `CamerMove Parcel ${parcelPaymentReference(input.parcelId)}`,
    phone: input.phone,
    email: input.email,
    method: input.method,
    meta: input.meta,
    notFoundMessage: "Colis introuvable",
    findFresh: async (tx) => (tx as typeof prisma).parcel.findUnique({ where: { id: input.parcelId } }) as unknown as { paymentId: string | null } | null,
    linkPayment: async (tx, paymentId) => {
      await (tx as typeof prisma).parcel.update({ where: { id: input.parcelId }, data: { paymentId } as never })
    },
    auditEntityMeta: { parcelId: input.parcelId },
  })
}

const confirmAdapter: ConfirmPaymentAdapter = {
  kind: "parcel",
  notFoundMessage: "Colis introuvable pour ce paiement",
  table: "Parcel",
  // Parcel has no pending_payment status — it stays `registered`; the paid flag is Payment.status.
  isConfirmable: () => true,
  findLink: async (paymentId, tx?) => {
    const client = (tx ?? prisma) as typeof prisma
    return (await client.parcel.findFirst({ where: { paymentId } })) as unknown as (ConfirmLink & {
      trackingNumber: string
    }) | null
  },
  confirm: async () => {},
  notification: (link) => ({
    topic: "camermove.payment.confirmed" as const,
    type: "payment.confirmed",
    userId: link.userId,
    payload: {
      bookingId: link.id,
      reference: (link as unknown as { trackingNumber: string }).trackingNumber,
      amount: link.totalAmount,
    },
  }),
}

/**
 * Confirm a parcel payment after success (webhook / reconciliation).
 * Idempotent: replay returns { confirmed: false } but still re-publishes the
 * payment.confirmed notification event for fan-out safety.
 * ACID ceremony lives in the booking-kernel.
 */
export async function confirmParcelPaymentSuccess(paymentId: string, event: unknown): Promise<{ confirmed: boolean; parcelId: string }> {
  const { entityId, confirmed } = await confirmPaymentSuccess(confirmAdapter, paymentId, event)
  return { confirmed, parcelId: entityId }
}

const cancelAdapter: CancelPendingAdapter<{ id: string; userId: string; status: string; totalAmount: number; trackingNumber: string; senderCity: string; recipientCity: string; shippingCost: number; paymentId: string | null }> = {
  notFoundMessage: "Colis introuvable",
  table: "Parcel",
  find: async (id) => {
    const row = (await prisma.parcel.findUnique({ where: { id } })) as unknown as { id: string; userId: string; status: string; trackingNumber: string; senderCity: string; recipientCity: string; shippingCost: number; paymentId: string | null } | null
    return row ? { ...row, totalAmount: row.shippingCost } : null
  },
  findFresh: async (tx, id) => {
    const row = (await (tx as typeof prisma).parcel.findUnique({ where: { id } })) as unknown as { id: string; userId: string; status: string; trackingNumber: string; shippingCost: number; paymentId: string | null } | null
    return row ? { ...row, totalAmount: row.shippingCost } : null
  },
  assertCancellable: async (entity) => {
    if (entity.status !== "registered") {
      throw new ConflictError(`Colis non annulable — statut: ${entity.status}`)
    }
    if (entity.paymentId) {
      const payment = await prisma.payment.findUnique({ where: { id: entity.paymentId } }).catch(() => null)
      if (payment && (payment as unknown as { status: string }).status === "success") {
        throw new ConflictError("Colis déjà payé — contactez le support pour toute annulation")
      }
    }
  },
  cancel: async (tx, entity) => {
    const t = tx as typeof prisma
    await t.parcelStatusLog.create({
      data: { parcelId: entity.id, status: "cancelled" as never, note: "Annulation par l'utilisateur" },
    })
    return t.parcel.update({ where: { id: entity.id }, data: { status: "cancelled" as never } })
  },
  auditAction: "parcel.booking.cancel",
  auditEntityType: "Parcel",
  auditExtra: (entity) => ({ trackingNumber: entity.trackingNumber, shippingCost: entity.shippingCost }),
  notification: (entity) => ({
    topic: "camermove.booking.status.changed" as const,
    type: "booking.status.changed",
    userId: entity.userId,
    payload: {
      parcelId: entity.id,
      trackingNumber: entity.trackingNumber,
      reference: entity.trackingNumber,
      amount: entity.shippingCost,
      serviceLabel: "Colis",
      entityLabel: `${entity.senderCity} → ${entity.recipientCity}`,
      newStatus: "cancelled",
      status: "cancelled",
    },
  }),
}

/**
 * User cancellation for a parcel. Cancellable only from `registered` with no
 * successful payment — a paid or in-transit parcel must go through support (409).
 * ACID ceremony lives in the booking-kernel.
 */
export async function cancelParcel(id: string, actorId: string, actorRole = "traveler") {
  const updated = await cancelIfPending(cancelAdapter, id, actorId, actorRole)
  try {
    await invalidateCache("parcels*")
    await invalidateCache("search*")
  } catch {}
  return updated
}

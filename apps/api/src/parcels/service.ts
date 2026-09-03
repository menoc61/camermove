import { prisma } from "@camermove/db"
import { BadRequestError, ConflictError, NotFoundError, ForbiddenError, loadEnv } from "@camermove/config"
import { getCached, setCached, invalidateCache } from "../lib/cache.js"

const SETTINGS_CACHE_KEY = "appsettings:global"
const SETTINGS_TTL = 30

export async function getAppSettingsCached() {
  try {
    const cached = await getCached<Record<string, unknown>>(SETTINGS_CACHE_KEY)
    if (cached) return cached as unknown as { commissionPercent: unknown; holdExpiryMinutes: number; featureFlags: unknown }
  } catch {}
  let settings = await prisma.appSettings.findUnique({ where: { id: "global" } })
  if (!settings) {
    try {
      settings = await prisma.appSettings.create({ data: { id: "global" } })
    } catch {
      settings = await prisma.appSettings.findUnique({ where: { id: "global" } })
    }
  }
  if (settings) {
    await setCached(SETTINGS_CACHE_KEY, settings as unknown as Record<string, unknown>, SETTINGS_TTL).catch(() => {})
    return settings as unknown as { commissionPercent: unknown; holdExpiryMinutes: number; featureFlags: unknown }
  }
  return { commissionPercent: 10, holdExpiryMinutes: 15, featureFlags: {} } as never
}

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

async function publishParcelEvent(topic: string, data: Record<string, unknown>) {
  try {
    const env = loadEnv() as unknown as Record<string, unknown>
    const { createKafkaClient } = await import("@camermove/events")
    const kafka = createKafkaClient(env as never)
    const producer = kafka.producer({ idempotent: true })
    await producer.connect().catch(() => {})
    await producer
      .send({
        topic: topic as never,
        messages: [{ key: String(data.id ?? data.trackingNumber ?? ""), value: JSON.stringify({ type: topic, ts: new Date().toISOString(), data }) }],
      })
      .catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}
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

  await publishParcelEvent("parcel.created", {
    id: created.id,
    trackingNumber,
    userId: input.userId,
    senderCity: input.senderCity,
    recipientCity: input.recipientCity,
    parcelType: input.parcelType,
    shippingCost,
  })

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
        metadata: { from: (updated as unknown as { upd: { status: string } }).upd ? undefined : undefined, nextStatus: input.nextStatus, location: input.location, note: input.note, ...(input.meta ?? {}) } as never,
      },
    })
  } catch {}
  await publishParcelEvent("parcel.status.updated", { id: input.parcelId, status: input.nextStatus, location: input.location })
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
  const amount = parcel.shippingCost
  if (input.provider === "cinetpay" && amount % 5 !== 0) throw new BadRequestError("Montant doit être multiple de 5 (XAF)")

  const existing = await prisma.payment.findFirst({ where: { id: parcel.paymentId ?? undefined } as never }).catch(() => null)
  if (existing && ["pending", "processing"].includes((existing as unknown as { status: string }).status)) {
    const authUrl = ((existing as unknown as { webhookPayload: Record<string, unknown> | null }).webhookPayload)?.authorizationUrl as string | undefined
    return { payment: existing, authorizationUrl: authUrl ?? null }
  }

  const env = loadEnv() as Record<string, unknown>
  const reference = `PARCEL-${input.parcelId.slice(0, 8).toUpperCase()}`
  const baseUrl = env.API_URL as string | undefined
  const frontendUrl = env.FRONTEND_URL as string | undefined
  const callbackBase = (frontendUrl ?? baseUrl ?? "https://camermove.cm") as string
  const callbackUrl = `${String(callbackBase).replace(/\/$/, "")}/payment/callback?reference=${reference}`
  const notifyUrl = `${String((baseUrl ?? "https://camermove.cm") as string).replace(/\/$/, "")}/api/v1/webhooks/${input.provider}`
  const methodToChannels = (m?: string): "ALL" | "MOBILE_MONEY" | "CREDIT_CARD" | "WALLET" => {
    if (m === "mobile_money") return "MOBILE_MONEY"
    if (m === "card") return "CREDIT_CARD"
    if (m === "bank_transfer") return "WALLET"
    return "ALL"
  }
  const { getProvider } = await import("../payments/providers/index.js")
  const provider = getProvider(input.provider as never)
  const result = await provider.createPayment({
    bookingId: input.parcelId,
    reference,
    amount,
    currency: "XAF",
    email: input.email,
    phone: input.phone,
    description: `CamerMove Parcel ${reference}`,
    callbackUrl,
    notifyUrl,
    channels: methodToChannels(input.method),
  })

  const payment = await prisma.$transaction(async (tx: unknown) => {
    const t = tx as {
      parcel: { findUnique: (a: unknown) => Promise<unknown> }
      payment: { findUnique: (a: unknown) => Promise<unknown>; create: (a: unknown) => Promise<unknown> }
      auditLog: { create: (a: unknown) => Promise<unknown> }
    }
    const fresh = (await (t.parcel as unknown as { findUnique: (a: unknown) => Promise<unknown> }).findUnique({ where: { id: input.parcelId } })) as unknown as { paymentId: string | null } | null
    if (!fresh) throw new NotFoundError("Colis introuvable")
    if (fresh.paymentId) {
      const linked = await t.payment.findUnique({ where: { id: fresh.paymentId } }).catch(() => null)
      if (linked && ["pending", "processing"].includes((linked as { status: string }).status)) return linked
    }
    const created = await t.payment.create({
      data: {
        bookingId: null as never,
        provider: input.provider as never,
        providerRef: result.providerRef,
        amount,
        currency: "XAF",
        method: (input.method as never) ?? "mobile_money",
        status: "pending" as never,
        webhookPayload: { ...((result.rawResponse as Record<string, unknown>) ?? {}), authorizationUrl: result.authorizationUrl } as never,
      },
    })
    // Need to link via tx.parcel.update but prisma.$transaction with tx object — use tx.parcel.update if available, else prisma.parcel.update
    const txParcel = (tx as unknown as { parcel: { update: (a: unknown) => Promise<unknown> } }).parcel
    if (txParcel?.update) {
      await txParcel.update({ where: { id: input.parcelId }, data: { paymentId: (created as { id: string }).id } as never })
    } else {
      await prisma.parcel.update({ where: { id: input.parcelId }, data: { paymentId: (created as { id: string }).id } as never })
    }
    await t.auditLog.create({
      data: {
        actorId: input.userId,
        action: "payment.create",
        entityType: "Payment",
        entityId: (created as { id: string }).id,
        metadata: { parcelId: input.parcelId, provider: input.provider, amount, ip: (input.meta as Record<string, unknown> | undefined)?.ip, ua: (input.meta as Record<string, unknown> | undefined)?.userAgent } as never,
      },
    })
    return created
  })

  try {
    const { createKafkaClient } = await import("@camermove/events")
    const { EVENT_TOPICS } = await import("@camermove/events")
    const kafka = createKafkaClient(env as never)
    const producer = kafka.producer({ idempotent: true })
    await producer.connect().catch(() => {})
    await producer
      .send({
        topic: (EVENT_TOPICS as unknown as Record<string, string>).paymentInitiated ?? "camermove.payment.initiated",
        messages: [{ key: (payment as { id: string }).id, value: JSON.stringify({ paymentId: (payment as { id: string }).id, parcelId: input.parcelId, provider: input.provider, amount }) }],
      })
      .catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}

  return { payment, authorizationUrl: result.authorizationUrl }
}

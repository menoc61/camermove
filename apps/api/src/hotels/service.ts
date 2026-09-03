import { prisma } from "@camermove/db"
import { ConflictError, NotFoundError, BadRequestError, loadEnv } from "@camermove/config"
import { getCached, setCached, invalidateCache } from "../lib/cache.js"

const SETTINGS_CACHE_KEY = "appsettings:global"
const SETTINGS_TTL = 30

async function getHoldExpiryMinutes(): Promise<number> {
  try {
    const cached = await getCached<Record<string, unknown>>(SETTINGS_CACHE_KEY)
    if (cached && typeof (cached as { holdExpiryMinutes?: unknown }).holdExpiryMinutes === "number") {
      return Number((cached as { holdExpiryMinutes: number }).holdExpiryMinutes)
    }
  } catch {}
  try {
    const s = await prisma.appSettings.findUnique({ where: { id: "global" } })
    if (s) {
      await setCached(SETTINGS_CACHE_KEY, s as unknown as Record<string, unknown>, SETTINGS_TTL).catch(() => {})
      return Number((s as unknown as { holdExpiryMinutes: number }).holdExpiryMinutes ?? 15)
    }
  } catch {}
  return 15
}

function calcNights(checkInDate: Date, checkOutDate: Date): number {
  const ms = checkOutDate.getTime() - checkInDate.getTime()
  return Math.max(1, Math.ceil(ms / 86400000))
}

async function publishHotelBookingCreated(data: Record<string, unknown>) {
  try {
    const env = loadEnv() as unknown as Record<string, unknown>
    const { createKafkaClient } = await import("@camermove/events")
    const kafka = createKafkaClient(env as never)
    const producer = kafka.producer({ idempotent: true })
    await producer.connect().catch(() => {})
    await producer
      .send({
        topic: "hotel.booking.created" as never,
        messages: [{ key: String(data.id ?? ""), value: JSON.stringify({ type: "hotel.booking.created", ts: new Date().toISOString(), data }) }],
      })
      .catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}
}

export async function createHotelBooking(input: {
  hotelId: string
  roomTypeId: string
  userId: string
  checkInDate: Date
  checkOutDate: Date
  guestCount: number
  guestNames: string[]
  specialRequests?: string
  meta?: Record<string, unknown>
}) {
  if (input.checkOutDate.getTime() <= input.checkInDate.getTime()) {
    throw new BadRequestError("checkOut doit être après checkIn")
  }

  const booking = await prisma.$transaction(async (tx: any) => {
    // FOR UPDATE on HotelRoom to serialize concurrent availability checks
    const rows: Array<{ id: string; hotelId: string; quantity: number; pricePerNight: number }> = await tx.$queryRaw`
      SELECT "id","hotelId","quantity","pricePerNight" FROM "HotelRoom" WHERE "id"=${input.roomTypeId} FOR UPDATE
    `
    const room = rows[0]
    if (!room) throw new NotFoundError("Type de chambre introuvable")
    if (room.hotelId !== input.hotelId) throw new BadRequestError("Chambre invalide pour cet hôtel")

    // Overlap count: status in pending_payment,confirmed AND checkInDate < newCheckOut AND checkOutDate > newCheckIn (strict lt/gt so adjacent dates do not overlap)
    const overlapping: number = await tx.hotelBooking.count({
      where: {
        roomTypeId: input.roomTypeId,
        status: { in: ["pending_payment", "confirmed"] },
        checkInDate: { lt: input.checkOutDate },
        checkOutDate: { gt: input.checkInDate },
      },
    })
    if (overlapping >= room.quantity) {
      throw new ConflictError("Plus de disponibilité pour ces dates")
    }

    const nights = calcNights(input.checkInDate, input.checkOutDate)
    const totalAmount = room.pricePerNight * nights
    const holdExpiryMinutes = await getHoldExpiryMinutes()
    const holdExpiresAt = new Date(Date.now() + holdExpiryMinutes * 60 * 1000)

    const created = await tx.hotelBooking.create({
      data: {
        hotelId: input.hotelId,
        roomTypeId: input.roomTypeId,
        userId: input.userId,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        guestCount: input.guestCount,
        guestNames: input.guestNames,
        specialRequests: input.specialRequests,
        totalAmount,
        status: "pending_payment" as never,
      } as never,
      include: { hotel: true, roomType: true },
    })
    return { created, holdExpiresAt, nights, totalAmount }
  })

  // Best-effort audit + kafka + cache invalidation (outside tx)
  const created = (booking as { created: Record<string, unknown>; holdExpiresAt: Date }).created as { id: string; totalAmount: number }
  const holdExpiresAt: Date = (booking as { holdExpiresAt: Date }).holdExpiresAt
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.userId,
        action: "hotel.booking.create",
        entityType: "HotelBooking",
        entityId: created.id,
        metadata: {
          hotelId: input.hotelId,
          roomTypeId: input.roomTypeId,
          guestCount: input.guestCount,
          totalAmount: created.totalAmount,
          checkInDate: input.checkInDate.toISOString(),
          checkOutDate: input.checkOutDate.toISOString(),
          ...(input.meta ?? {}),
        } as never,
      },
    })
  } catch {}
  await publishHotelBookingCreated({
    id: created.id,
    hotelId: input.hotelId,
    roomTypeId: input.roomTypeId,
    userId: input.userId,
    checkInDate: input.checkInDate.toISOString(),
    checkOutDate: input.checkOutDate.toISOString(),
    guestCount: input.guestCount,
    totalAmount: created.totalAmount,
  })
  try {
    await invalidateCache("hotels*")
    await invalidateCache("search*")
  } catch {}

  return { ...(created as unknown as Record<string, unknown>), holdExpiresAt } as unknown as typeof created & { holdExpiresAt: Date }
}

export async function createHotelBookingPayment(input: {
  hotelBookingId: string
  userId: string
  provider: "notchpay" | "cinetpay"
  phone?: string
  email?: string
  method?: string
  meta?: Record<string, unknown>
}) {
  const hb = await prisma.hotelBooking.findUnique({ where: { id: input.hotelBookingId } })
  if (!hb) throw new NotFoundError("Réservation hôtel introuvable")
  if ((hb as unknown as { userId: string }).userId !== input.userId) {
    const { ForbiddenError } = await import("@camermove/config")
    throw new ForbiddenError("Accès refusé")
  }
  if ((hb as unknown as { status: string }).status !== "pending_payment") {
    throw new ConflictError(`Réservation non payable — statut: ${(hb as unknown as { status: string }).status}`)
  }
  const existing = await prisma.payment.findFirst({
    where: { id: (hb as unknown as { paymentId: string | null }).paymentId ?? undefined } as never,
  }).catch(() => null)
  // one-pending guard via paymentId linked payment check (if already linked and pending)
  if (existing && (existing as unknown as { status: string }).status in ["pending", "processing"]) {
    const authUrl = ((existing as unknown as { webhookPayload: Record<string, unknown> | null }).webhookPayload)?.authorizationUrl as string | undefined
    return { payment: existing, authorizationUrl: authUrl ?? null }
  }

  const amount = (hb as unknown as { totalAmount: number }).totalAmount
  if (input.provider === "cinetpay" && amount % 5 !== 0) throw new BadRequestError("Montant doit être multiple de 5 (XAF)")

  const env = loadEnv() as Record<string, unknown>
  const reference = `HOTEL-${input.hotelBookingId.slice(0, 8).toUpperCase()}`
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
    bookingId: input.hotelBookingId,
    reference,
    amount,
    currency: "XAF",
    email: input.email,
    phone: input.phone,
    description: `CamerMove Hotel ${reference}`,
    callbackUrl,
    notifyUrl,
    channels: methodToChannels(input.method),
  })

  const payment = await prisma.$transaction(async (tx: any) => {
    // re-check duplicate inside tx
    const fresh = await tx.hotelBooking.findUnique({ where: { id: input.hotelBookingId } })
    if (!fresh) throw new NotFoundError("Réservation hôtel introuvable")
    if (fresh.paymentId) {
      const linked = await tx.payment.findUnique({ where: { id: fresh.paymentId } }).catch(() => null)
      if (linked && ["pending", "processing"].includes((linked as { status: string }).status)) return linked
    }
    const created = await tx.payment.create({
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
    await tx.hotelBooking.update({ where: { id: input.hotelBookingId }, data: { paymentId: created.id } as never })
    await tx.auditLog.create({
      data: {
        actorId: input.userId,
        action: "payment.create",
        entityType: "Payment",
        entityId: created.id,
        metadata: { hotelBookingId: input.hotelBookingId, provider: input.provider, amount, ip: (input.meta as Record<string, unknown> | undefined)?.ip, ua: (input.meta as Record<string, unknown> | undefined)?.userAgent } as never,
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
        messages: [{ key: (payment as { id: string }).id, value: JSON.stringify({ paymentId: (payment as { id: string }).id, hotelBookingId: input.hotelBookingId, provider: input.provider, amount }) }],
      })
      .catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}

  return { payment, authorizationUrl: result.authorizationUrl }
}

export { calcNights, getHoldExpiryMinutes }

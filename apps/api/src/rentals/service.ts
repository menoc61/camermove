import { prisma } from "@camermove/db"
import { BadRequestError, ConflictError, NotFoundError, loadEnv } from "@camermove/config"
import { invalidateCache } from "../lib/cache.js"

export type DurationUnit = "hour" | "day" | "week" | "month"

export function durationFor(
  vehicle: { durationUnit: string },
  startDate: Date,
  endDate: Date,
): number {
  const ms = endDate.getTime() - startDate.getTime()
  if (ms <= 0) throw new BadRequestError("endDate doit être après startDate")
  const unit = vehicle.durationUnit as DurationUnit
  if (unit === "hour") return Math.max(1, Math.ceil(ms / 3600000))
  if (unit === "week") return Math.max(1, Math.ceil(ms / (86400000 * 7)))
  if (unit === "month") return Math.max(1, Math.ceil(ms / (86400000 * 30)))
  // default day
  return Math.max(1, Math.ceil(ms / 86400000))
}

async function publishRentalBookingCreated(data: Record<string, unknown>) {
  try {
    const env = loadEnv() as unknown as Record<string, unknown>
    const { createKafkaClient } = await import("@camermove/events")
    const kafka = createKafkaClient(env as never)
    const producer = kafka.producer({ idempotent: true })
    await producer.connect().catch(() => {})
    await producer
      .send({
        topic: "rental.booking.created" as never,
        messages: [{ key: String(data.id ?? ""), value: JSON.stringify({ type: "rental.booking.created", ts: new Date().toISOString(), data }) }],
      })
      .catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}
}

export async function createRentalBooking(input: {
  rentalVehicleId: string
  userId: string
  startDate: Date
  endDate: Date
  pickupCity: string
  pickupAddress?: string
  dropoffCity?: string
  dropoffAddress?: string
  driverName?: string
  driverPhone?: string
  meta?: Record<string, unknown>
}) {
  if (input.endDate.getTime() <= input.startDate.getTime()) {
    throw new BadRequestError("endDate doit être après startDate")
  }

  const created = await prisma.$transaction(async (tx: any) => {
    const rows: Array<{ id: string; pricePerUnit: number; durationUnit: string; status: string }> =
      await tx.$queryRaw`SELECT "id","pricePerUnit","durationUnit","status" FROM "RentalVehicle" WHERE "id"=${input.rentalVehicleId} FOR UPDATE`
    const vehicle = rows[0]
    if (!vehicle) throw new NotFoundError("Véhicule introuvable")
    if (vehicle.status !== "available") throw new ConflictError("Véhicule non disponible")

    const overlap = await tx.rentalBooking.findFirst({
      where: {
        rentalVehicleId: input.rentalVehicleId,
        status: { in: ["pending_payment", "confirmed", "active"] },
        startDate: { lt: input.endDate },
        endDate: { gt: input.startDate },
      },
    })
    if (overlap) throw new ConflictError("Véhicule déjà réservé sur cette période")

    const duration = durationFor({ durationUnit: vehicle.durationUnit }, input.startDate, input.endDate)
    const totalAmount = vehicle.pricePerUnit * duration

    const booking = await tx.rentalBooking.create({
      data: {
        rentalVehicleId: input.rentalVehicleId,
        userId: input.userId,
        startDate: input.startDate,
        endDate: input.endDate,
        duration,
        durationUnit: vehicle.durationUnit as never,
        totalAmount,
        pickupCity: input.pickupCity,
        pickupAddress: input.pickupAddress,
        dropoffCity: input.dropoffCity ?? input.pickupCity,
        dropoffAddress: input.dropoffAddress,
        driverName: input.driverName,
        driverPhone: input.driverPhone,
        status: "pending_payment" as never,
      } as never,
      include: { vehicle: true },
    })
    return booking
  })

  const bid = (created as unknown as { id: string }).id
  const totalAmount = (created as unknown as { totalAmount: number }).totalAmount
  const duration = (created as unknown as { duration: number }).duration

  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.userId,
        action: "rental.booking.create",
        entityType: "RentalBooking",
        entityId: bid,
        metadata: {
          rentalVehicleId: input.rentalVehicleId,
          duration,
          totalAmount,
          startDate: input.startDate.toISOString(),
          endDate: input.endDate.toISOString(),
          pickupCity: input.pickupCity,
          dropoffCity: input.dropoffCity ?? input.pickupCity,
          ...(input.meta ?? {}),
        } as never,
      },
    })
  } catch {}

  await publishRentalBookingCreated({
    id: bid,
    rentalVehicleId: input.rentalVehicleId,
    userId: input.userId,
    startDate: input.startDate.toISOString(),
    endDate: input.endDate.toISOString(),
    totalAmount,
    pickupCity: input.pickupCity,
    dropoffCity: input.dropoffCity ?? input.pickupCity,
  })

  try {
    await invalidateCache("rentals*")
    await invalidateCache("search*")
  } catch {}

  return created
}

export async function createRentalBookingPayment(input: {
  rentalBookingId: string
  userId: string
  provider: "notchpay" | "cinetpay"
  phone?: string
  email?: string
  method?: string
  meta?: Record<string, unknown>
}) {
  const rb = await prisma.rentalBooking.findUnique({ where: { id: input.rentalBookingId } })
  if (!rb) throw new NotFoundError("Réservation location introuvable")
  if ((rb as unknown as { userId: string }).userId !== input.userId) {
    const { ForbiddenError } = await import("@camermove/config")
    throw new ForbiddenError("Accès refusé")
  }
  if ((rb as unknown as { status: string }).status !== "pending_payment") {
    throw new ConflictError(`Réservation non payable — statut: ${(rb as unknown as { status: string }).status}`)
  }

  const existing = await prisma.payment
    .findFirst({ where: { id: (rb as unknown as { paymentId: string | null }).paymentId ?? undefined } as never })
    .catch(() => null)
  if (existing && ["pending", "processing"].includes((existing as unknown as { status: string }).status)) {
    const authUrl = ((existing as unknown as { webhookPayload: Record<string, unknown> | null }).webhookPayload)?.authorizationUrl as string | undefined
    return { payment: existing, authorizationUrl: authUrl ?? null }
  }

  const amount = (rb as unknown as { totalAmount: number }).totalAmount
  if (input.provider === "cinetpay" && amount % 5 !== 0) throw new BadRequestError("Montant doit être multiple de 5 (XAF)")

  const env = loadEnv() as Record<string, unknown>
  const reference = `RENTAL-${input.rentalBookingId.slice(0, 8).toUpperCase()}`
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
    bookingId: input.rentalBookingId,
    reference,
    amount,
    currency: "XAF",
    email: input.email,
    phone: input.phone,
    description: `CamerMove Rental ${reference}`,
    callbackUrl,
    notifyUrl,
    channels: methodToChannels(input.method),
  })

  const payment = await prisma.$transaction(async (tx: any) => {
    const fresh = await tx.rentalBooking.findUnique({ where: { id: input.rentalBookingId } })
    if (!fresh) throw new NotFoundError("Réservation location introuvable")
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
    await tx.rentalBooking.update({ where: { id: input.rentalBookingId }, data: { paymentId: created.id } as never })
    await tx.auditLog.create({
      data: {
        actorId: input.userId,
        action: "payment.create",
        entityType: "Payment",
        entityId: created.id,
        metadata: { rentalBookingId: input.rentalBookingId, provider: input.provider, amount, ip: (input.meta as Record<string, unknown> | undefined)?.ip, ua: (input.meta as Record<string, unknown> | undefined)?.userAgent } as never,
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
        messages: [{ key: (payment as { id: string }).id, value: JSON.stringify({ paymentId: (payment as { id: string }).id, rentalBookingId: input.rentalBookingId, provider: input.provider, amount }) }],
      })
      .catch(() => {})
    await producer.disconnect().catch(() => {})
  } catch {}

  return { payment, authorizationUrl: result.authorizationUrl }
}

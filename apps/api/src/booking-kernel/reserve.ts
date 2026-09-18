import { prisma } from "@camermove/db"
import { getAppSettingsCached } from "@camermove/db"
import { ConflictError, NotFoundError } from "@camermove/config"
import { EVENT_TOPICS, makeEvent, publishEvent } from "@camermove/events"
import { scheduleHoldExpiry } from "@camermove/shared/queues"
import { createLogger } from "@camermove/config"
import { getAdapter } from "./adapters.js"

const log = createLogger()

export interface ReserveInput {
  kind: string
  userId: string
  meta: Record<string, unknown>
  checkInDate?: Date
  checkOutDate?: Date
  startDate?: Date
  endDate?: Date
  quantity?: number
  guestCount?: number
  guestNames?: string[]
  specialRequests?: string
  pickupCity?: string
  dropoffCity?: string
  driverName?: string
  driverPhone?: string
  hotelId?: string
  roomTypeId?: string
  eventId?: string
  ticketCategoryId?: string
  parcelType?: string
  weightKg?: number
  senderName?: string
  recipientName?: string
  senderCity?: string
  recipientCity?: string
}

export interface ReserveResult {
  id: string
  reference: string
  totalAmount: number
  status: string
  holdExpiresAt: Date
  meta: Record<string, unknown>
}

export async function reserve(input: ReserveInput): Promise<ReserveResult> {
  const adapter = getAdapter(input.kind as any)
  const holdMinutes = await getHoldExpiryMinutes()

  const result = await prisma.$transaction(async (tx: unknown) => {
    const t = tx as { $queryRawUnsafe: (q: string, ...v: unknown[]) => Promise<unknown> }

    // Lock the entity row
    await t.$queryRawUnsafe(`SELECT "id" FROM "${adapter.table}" WHERE "id" = $1 FOR UPDATE`, input.meta[adapter.idField] as string)

    // Load entity for availability check
    const entity = await adapter.find(input.meta[adapter.idField] as string)
    if (!entity) throw new NotFoundError(adapter.notFoundMessage)

    // Check availability via adapter-specific guard
    if (adapter.checkAvailability) await adapter.checkAvailability(entity as Record<string, unknown>, input, tx)

    // Build the record
    const reference = adapter.makeReference(input.meta[adapter.idField] as string)
    const totalAmount = adapter.calcTotalAmount(entity as Record<string, unknown>, input)

    const holdExpiresAt = new Date(Date.now() + holdMinutes * 60 * 1000)

    const record = await adapter.create({
      ...input.meta,
      userId: input.userId,
      reference,
      totalAmount,
      status: "pending_payment",
      holdExpiresAt,
    }, tx)

    // Schedule hold expiry
    try {
      await scheduleHoldExpiry(record.id as string, holdMinutes * 60 * 1000)
    } catch (e) {
      log.error({ err: (e as Error).message, entityId: record.id as string }, "scheduleHoldExpiry failed")
    }

    // Publish booking.created event
    try {
      await publishEvent(EVENT_TOPICS.bookingCreated, makeEvent(`${input.kind}.booking.created`, record.id as string, {
        type: `${input.kind}.booking.created`,
        userId: input.userId,
        reference,
        totalAmount,
      }))
    } catch {}

    return { id: record.id as string, reference, totalAmount, status: "pending_payment", holdExpiresAt, meta: input.meta }
  })

  return result
}

async function getHoldExpiryMinutes(): Promise<number> {
  try {
    const s = await getAppSettingsCached()
    const v = Number((s as unknown as { holdExpiryMinutes?: unknown }).holdExpiryMinutes ?? 15)
    return Number.isFinite(v) && v > 0 ? v : 15
  } catch {}
  return 15
}

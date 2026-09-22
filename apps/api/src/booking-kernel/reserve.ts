import { prisma } from "@camermove/db"
import { observeBooking } from "@camermove/observability"
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
  [key: string]: unknown
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

    // Load the inventory row (must exist before booking), locking it for
    // the availability check. Kinds without inventory (parcel) skip this:
    // every field they need already lives in meta.
    let entity: Record<string, unknown> = {}
    if (adapter.requiresInventory !== false) {
      await t.$queryRawUnsafe(`SELECT "id" FROM "${adapter.table}" WHERE "id" = $1 FOR UPDATE`, input.meta[adapter.idField] as string)
      const found = await adapter.find(input.meta[adapter.idField] as string)
      if (!found) throw new NotFoundError(adapter.notFoundMessage)
      entity = found as Record<string, unknown>
    }

    // Check availability via adapter-specific guard
    if (adapter.checkAvailability) await adapter.checkAvailability(entity, input, tx)

    // Build the record. Kinds with derived references (parcel) pre-generate
    // the row id so referenceForKind(id) matches the stored row for webhook
    // prefix-scan resolution.
    const newId = adapter.newEntityId?.()
    const reference = adapter.makeReference((newId ?? input.meta[adapter.idField] ?? "") as string)
    const totalAmount = adapter.calcTotalAmount(entity, input)

    const holdExpiresAt = new Date(Date.now() + holdMinutes * 60 * 1000)

    const createData = {
      ...input.meta,
      ...(newId ? { id: newId } : {}),
      userId: input.userId,
      reference,
      totalAmount,
      status: adapter.requiresInventory !== false ? "pending_payment" : "registered",
      holdExpiresAt,
    }
    const record = await adapter.create(
      adapter.mapCreateData ? adapter.mapCreateData(createData, input, entity) : createData,
      tx,
    )

    // Schedule hold expiry (only kinds with expiring holds)
    if (adapter.expiryTable) {
      try {
        await scheduleHoldExpiry(record.id as string, holdMinutes * 60 * 1000)
      } catch (e) {
        log.error({ err: (e as Error).message, entityId: record.id as string }, "scheduleHoldExpiry failed")
      }
    }

    // Transactional outbox write (migration 20260922000003_outbox, deploy-gated).
    // Until the table exists this throws a missing-table error (P2021) and we
    // fall through to the best-effort direct publish below. Any other error is
    // rethrown so real failures are never masked. Direct publish runs ONLY when
    // the outbox write signaled missing-table — never both (no double-publish).
    const topic = EVENT_TOPICS.bookingCreated
    const event = makeEvent(`${input.kind}.booking.created`, record.id as string, {
      type: `${input.kind}.booking.created`,
      userId: input.userId,
      reference,
      totalAmount,
    })
    let outboxed = false
    try {
      const outbox = await import("@camermove/events/outbox")
      await outbox.writeOutbox(tx as never, topic, record.id as string, event)
      outboxed = true
    } catch (e) {
      const { isMissingTableError } = await import("@camermove/events/outbox")
      if (!isMissingTableError(e)) throw e
      // Table not yet migrated: fall through to existing best-effort direct publish below.
    }
    if (!outboxed) {
      // Publish booking.created event
      try {
        await publishEvent(topic, event)
      } catch {}
    }

    // Single source for the creation metric across all kinds (routes don't
    // observe created — otherwise trip would double-count).
    try { observeBooking("created") } catch {}

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

/**
 * Transactional-outbox relay (deploy-gated, see migration 20260922000003_outbox).
 * Polls unsent Outbox rows written in-tx by booking-kernel/reserve.ts and
 * publishes them to Kafka, marking each sent. Until the migration is applied
 * the table is missing: the relay stays idle (one warn, then silent) and
 * reserve.ts falls back to best-effort direct publish — no double-publish.
 */
import { prisma } from "@camermove/db"
import { publishEvent, type EventTopic, type DomainEvent } from "@camermove/events"
import type { createLogger } from "@camermove/config"

type RelayLog = Pick<ReturnType<typeof createLogger>, "info" | "warn">

const BATCH = 50
const INTERVAL_MS = 5000
let missingTableWarned = false

async function relayOnce(log: RelayLog) {
  let rows: Array<{ id: string; topic: string; key: string; payload: unknown }>
  try {
    rows = (await (
      prisma as unknown as {
        outbox: { findMany: (a: unknown) => Promise<never[]> }
      }
    ).outbox.findMany({
      where: { sentAt: null },
      orderBy: { createdAt: "asc" },
      take: BATCH,
    })) as never[]
  } catch (e) {
    const { isMissingTableError } = await import("@camermove/events/outbox")
    if (isMissingTableError(e)) {
      if (!missingTableWarned) {
        log.warn("outbox table missing — relay idle until migration applied")
        missingTableWarned = true
      }
      return
    }
    throw e
  }
  for (const row of rows) {
    try {
      // Rows store the full DomainEvent envelope as payload (written by
      // writeOutbox); the key lives in event.aggregateId, so publishEvent
      // needs only (topic, payload) — its (topic, event) signature.
      await publishEvent(row.topic as EventTopic, row.payload as DomainEvent<never>)
      await (
        prisma as unknown as {
          outbox: { update: (a: unknown) => Promise<unknown> }
        }
      ).outbox.update({ where: { id: row.id }, data: { sentAt: new Date() } })
    } catch (e) {
      log.warn({ err: e, outboxId: row.id }, "outbox relay publish failed, will retry")
    }
  }
}

export function startOutboxRelay(log: RelayLog) {
  const timer = setInterval(() => {
    relayOnce(log).catch((e) => log.warn({ err: e }, "outbox relay cycle failed"))
  }, INTERVAL_MS)
  timer.unref?.()
  return () => clearInterval(timer)
}

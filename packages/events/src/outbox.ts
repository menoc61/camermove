/**
 * Typed outbox adapter — the single seam between domain modules and Kafka.
 * Owns: client lifecycle (one shared idempotent producer), envelope shape,
 * and the swallow-and-log best-effort policy. Domain modules call publishEvent()
 * and never import kafkajs / loadEnv / EVENT_TOPICS topic strings directly.
 */
import { createLogger, loadEnv } from "@camermove/config"
import type { Producer } from "kafkajs"
import { createKafkaClient } from "./kafka"
import { EVENT_TOPICS, type EventTopic } from "./topics"
import type { DomainEvent } from "./types"

const log = createLogger()

let producerPromise: Promise<Producer> | null = null

function getProducer(): Promise<Producer> {
  if (!producerPromise) {
    producerPromise = (async () => {
      const env = loadEnv() as never
      const kafka = createKafkaClient(env)
      const producer = kafka.producer({ idempotent: true })
      await producer.connect()
      return producer
    })().catch((err: Error) => {
      producerPromise = null
      throw err
    })
  }
  return producerPromise
}

export function makeEvent<T>(type: string, aggregateId: string, data: T): DomainEvent<T> {
  return { id: `${type}-${aggregateId}`, type, ts: new Date().toISOString(), aggregateId, data }
}

/** Typed envelope helper for legacy "data-only" events (no aggregate wrapper). */
export function makeDataEvent(type: string, key: string, data: Record<string, unknown>): DomainEvent<Record<string, unknown>> {
  return { id: `${type}-${key}-${Date.now()}`, type, ts: new Date().toISOString(), aggregateId: key, data }
}

/**
 * Best-effort typed publish: never throws, never blocks business flow.
 * Errors are logged (swallow-and-log policy) — retried by upstream replay, not here.
 */
export async function publishEvent<T>(topic: EventTopic, event: DomainEvent<T>): Promise<void> {
  try {
    const producer = await getProducer()
    await producer.send({ topic, messages: [{ key: event.aggregateId, value: JSON.stringify(event) }] })
    log.info({ topic, id: event.id }, "event published")
  } catch (err) {
    log.warn({ err: (err as Error).message, topic, id: event.id }, "event publish failed (best-effort)")
  }
}

/** Publish without the aggregate wrapper — same seam, legacy payload shape. */
export async function publishDataEvent(topic: EventTopic, event: DomainEvent<Record<string, unknown>>): Promise<void> {
  await publishEvent(topic, event)
}

/** Typed helpers for common lifecycle events — domain modules call these. */
export async function publishBookingCreated(kind: "trip" | "hotel" | "rental" | "event" | "parcel", entityId: string, payload: Record<string, unknown>): Promise<void> {
  await publishEvent(
    EVENT_TOPICS.bookingCreated,
    makeEvent(`${kind}.booking.created`, entityId, { type: `${kind}.booking.created`, ...payload }),
  )
}

export async function publishBookingConfirmed(kind: "trip" | "hotel" | "rental" | "event" | "parcel", entityId: string, userId: string, payload: Record<string, unknown>): Promise<void> {
  const topicMap: Record<string, EventTopic> = {
    trip: EVENT_TOPICS.bookingConfirmed,
    hotel: EVENT_TOPICS.hotelBookingConfirmed,
    rental: EVENT_TOPICS.rentalBookingConfirmed,
    event: EVENT_TOPICS.eventBookingConfirmed,
    parcel: EVENT_TOPICS.paymentConfirmed,
  }
  const topic = topicMap[kind]
  if (!topic) return
  await publishEvent(
    topic,
    makeEvent(`${kind}.booking.confirmed`, entityId, { type: `${kind}.booking.confirmed`, userId, payload }),
  )
}

export async function publishBookingCancelled(kind: "trip" | "hotel" | "rental" | "event" | "parcel", entityId: string, userId: string, payload: Record<string, unknown>): Promise<void> {
  await publishEvent(
    EVENT_TOPICS.bookingStatusChanged,
    makeEvent("booking.status.changed", entityId, { type: "booking.status.changed", userId, payload: { ...payload, newStatus: "cancelled", status: "cancelled" } }),
  )
}

export async function publishPaymentInitiated(kind: "trip" | "hotel" | "rental" | "event" | "parcel", paymentId: string, payload: Record<string, unknown>): Promise<void> {
  await publishEvent(
    EVENT_TOPICS.paymentInitiated,
    makeEvent("payment.initiated", paymentId, { type: "payment.initiated", ...payload }),
  )
}

export async function publishPaymentConfirmed(entityId: string, userId: string, payload: Record<string, unknown>): Promise<void> {
  await publishEvent(
    EVENT_TOPICS.paymentConfirmed,
    makeEvent("payment.confirmed", entityId, { type: "payment.confirmed", userId, payload }),
  )
}

export async function publishTicketIssued(bookingId: string, userId: string, payload: Record<string, unknown>): Promise<void> {
  await publishEvent(
    EVENT_TOPICS.ticketIssued,
    makeEvent("ticket.issued", bookingId, { type: "ticket.issued", userId, payload }),
  )
}

/** Typed cache invalidation helper — call after successful writes.
 * Note: actual invalidation is done by the calling service (hotels, rentals, etc.)
 * to avoid circular deps. This is a no-op placeholder for future extraction. */
export async function invalidateKind(_kind: "trip" | "hotel" | "rental" | "event" | "parcel"): Promise<void> {
  // Services handle their own cache invalidation
}

/** Graceful-shutdown hook. */
export async function closeOutbox(): Promise<void> {
  if (!producerPromise) return
  try {
    const producer = await producerPromise
    await producer.disconnect()
  } catch (err) {
    log.warn({ err: (err as Error).message }, "outbox disconnect failed")
  } finally {
    producerPromise = null
  }
}
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

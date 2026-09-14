import type { Kafka } from "kafkajs"
import IORedis from "ioredis"
import { z } from "zod"
import type { Env } from "@camermove/config"
import { createLogger, loadEnv } from "@camermove/config"
import type { EventTopic } from "./topics"
import type { DomainEvent } from "./types"
import { createEventProducer } from "./producer"

const log = createLogger()

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void>

/**
 * Zod schema for the wire-format DomainEvent. Producers may emit any `data`
 * shape — workers narrow it with their own per-topic schemas, but the envelope
 * is fixed so the consumer can validate cheaply.
 */
const DomainEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  ts: z.string().datetime(),
  aggregateId: z.string(),
  data: z.unknown(),
})

const MAX_PROCESSED_IDS = 10000
const MAX_HANDLER_ATTEMPTS = 5
const PROCESSED_TTL_SECONDS = 24 * 60 * 60 // 24h
const ATTEMPTS_TTL_SECONDS = 7 * 24 * 60 * 60 // 7d

let sharedRedis: IORedis | null = null

/**
 * Lazy Redis singleton for processed-id dedup + per-message attempt counters.
 * Returns null in test env (matches db settings) so unit tests never hit Redis.
 */
function getRedis(): IORedis | null {
  if (loadEnv().NODE_ENV === "test") return null
  if (sharedRedis) return sharedRedis
  sharedRedis = new IORedis(loadEnv().REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  })
  sharedRedis.on("error", (err: Error) => log.warn({ err: err.message }, "consumer redis error"))
  return sharedRedis
}

function dlqTopic(topic: string): string {
  return `${topic}.dlq`
}

export function createEventConsumer(
  kafka: Kafka,
  env: Env,
  handlers: Partial<Record<EventTopic, EventHandler>>,
) {
  const groupId = `camermove-worker-${env.NODE_ENV}`
  const consumer = kafka.consumer({ groupId })
  const dlqProducer = createEventProducer(kafka, env)

  // Memory fallbacks so the consumer keeps working when Redis is unavailable.
  const processedIdsMem = new Set<string>()
  const attemptCountsMem = new Map<string, number>()

  const markProcessedMem = (id: string) => {
    processedIdsMem.add(id)
    if (processedIdsMem.size > MAX_PROCESSED_IDS) {
      const oldest = processedIdsMem.values().next().value
      if (oldest) processedIdsMem.delete(oldest)
    }
  }

  const processedKey = () => `kafka:processed:${groupId}`
  const attemptsKey = (topic: string, partition: number, offset: string) =>
    `kafka:dlq:attempts:${topic}:${partition}:${offset}`

  const seenProcessed = async (id: string): Promise<boolean> => {
    const r = getRedis()
    if (!r) return processedIdsMem.has(id)
    try {
      const v = await r.sismember(processedKey(), id)
      return v === 1
    } catch (err) {
      log.warn({ err: (err as Error).message }, "processed-id redis check failed; using memory")
      return processedIdsMem.has(id)
    }
  }

  const rememberProcessed = async (id: string): Promise<void> => {
    markProcessedMem(id)
    const r = getRedis()
    if (!r) return
    try {
      await r.multi().sadd(processedKey(), id).expire(processedKey(), PROCESSED_TTL_SECONDS).exec()
    } catch (err) {
      log.warn({ err: (err as Error).message }, "processed-id redis write failed")
    }
  }

  const bumpAttempt = async (topic: string, partition: number, offset: string): Promise<number> => {
    const key = attemptsKey(topic, partition, offset)
    const r = getRedis()
    if (!r) {
      const memKey = `${topic}:${partition}:${offset}`
      const cur = (attemptCountsMem.get(memKey) ?? 0) + 1
      attemptCountsMem.set(memKey, cur)
      return cur
    }
    try {
      const next = await r.incr(key)
      if (next === 1) await r.expire(key, ATTEMPTS_TTL_SECONDS)
      return next
    } catch (err) {
      log.warn({ err: (err as Error).message }, "attempts redis incr failed; using memory")
      const memKey = `${topic}:${partition}:${offset}`
      const cur = (attemptCountsMem.get(memKey) ?? 0) + 1
      attemptCountsMem.set(memKey, cur)
      return cur
    }
  }

  return {
    async connect() {
      const admin = kafka.admin()
      try {
        await admin.connect()
        await admin.createTopics({
          waitForLeaders: true,
          topics: Object.keys(handlers).map((topic) => ({ topic })),
        })
      } catch (err) {
        log.error({ err }, "topic provisioning failed")
        throw err
      } finally {
        await admin.disconnect().catch((e) => log.warn({ e }, "admin disconnect failed"))
      }
      await dlqProducer.connect()
      await consumer.connect()
      for (const topic of Object.keys(handlers)) {
        await consumer.subscribe({ topic, fromBeginning: true })
        log.info({ topic }, "subscribed")
      }
      await consumer.run({
        autoCommit: false,
        eachMessage: async ({ topic, partition, message }) => {
          const commitOffset = () =>
            consumer.commitOffsets([
              { topic, partition, offset: String(BigInt(message.offset) + 1n) },
            ])
          const handler = handlers[topic as EventTopic]
          if (!handler) {
            await commitOffset()
            return
          }
          // Parse + schema-validate. Bad payloads go to the DLQ and we commit
          // the offset (no infinite retry loop on malformed input).
          const raw = message.value?.toString() ?? ""
          let event: DomainEvent | null = null
          try {
            const json = JSON.parse(raw)
            event = DomainEventSchema.parse(json) as DomainEvent
          } catch (err) {
            log.warn(
              { topic, partition, offset: message.offset, err: (err as Error).message },
              "malformed event; routing to DLQ",
            )
            try {
              await dlqProducer.publish(dlqTopic(topic) as EventTopic, {
                id: `dlq-${topic}-${partition}-${message.offset}`,
                type: "event.malformed",
                ts: new Date().toISOString(),
                aggregateId: `${topic}:${partition}:${message.offset}`,
                data: { raw, reason: (err as Error).message },
              } as DomainEvent)
            } catch (publishErr) {
              log.error({ err: publishErr }, "DLQ publish failed for malformed event")
            }
            await commitOffset()
            return
          }
          if (await seenProcessed(event.id)) {
            await commitOffset()
            return
          }
          try {
            await (handler as EventHandler)(event)
            await rememberProcessed(event.id)
            await commitOffset()
            log.info({ topic, id: event.id }, "event handled")
          } catch (err) {
            const attempts = await bumpAttempt(topic, partition, message.offset)
            if (attempts >= MAX_HANDLER_ATTEMPTS) {
              log.warn(
                { topic, partition, offset: message.offset, id: event.id, attempts, err },
                "handler failed repeatedly; routing to DLQ",
              )
              try {
                await dlqProducer.publish(dlqTopic(topic) as EventTopic, {
                  id: `dlq-${event.id}`,
                  type: "event.handler_exhausted",
                  ts: new Date().toISOString(),
                  aggregateId: event.aggregateId,
                  data: { original: event, attempts, error: (err as Error).message },
                } as DomainEvent)
              } catch (publishErr) {
                log.error({ err: publishErr }, "DLQ publish failed for exhausted handler")
              }
              await rememberProcessed(event.id)
              await commitOffset()
              return
            }
            log.error(
              { topic, partition, offset: message.offset, id: event.id, attempts, err },
              "event handling failed; rethrowing for kafkajs retry",
            )
            throw err
          }
        },
      })
    },
    async disconnect() {
      await consumer.disconnect().catch((e) => log.warn({ e }, "consumer disconnect failed"))
      await dlqProducer.disconnect().catch((e) => log.warn({ e }, "dlq producer disconnect failed"))
    },
  }
}
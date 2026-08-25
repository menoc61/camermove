import type { Kafka } from "kafkajs"
import type { Env } from "@camermove/config"
import { createLogger } from "@camermove/config"
import type { EventTopic } from "./topics"
import type { DomainEvent } from "./types"

const log = createLogger()

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void>

const MAX_PROCESSED_IDS = 10000

export function createEventConsumer(
  kafka: Kafka,
  env: Env,
  handlers: Partial<Record<EventTopic, EventHandler>>,
) {
  const groupId = `camermove-worker-${env.NODE_ENV}`
  const consumer = kafka.consumer({ groupId })
  const processedIds = new Set<string>()

  const markProcessed = (id: string) => {
    processedIds.add(id)
    if (processedIds.size > MAX_PROCESSED_IDS) {
      const oldest = processedIds.values().next().value
      if (oldest) processedIds.delete(oldest)
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
          const event: DomainEvent = JSON.parse(message.value!.toString())
          if (processedIds.has(event.id)) {
            await commitOffset()
            return
          }
          try {
            await (handler as EventHandler)(event)
            markProcessed(event.id)
            await commitOffset()
            log.info({ topic, id: event.id }, "event handled")
          } catch (err) {
            log.error({ topic, id: event.id, err }, "event handling failed; retrying")
            throw err
          }
        },
      })
    },
    async disconnect() {
      await consumer.disconnect()
    },
  }
}

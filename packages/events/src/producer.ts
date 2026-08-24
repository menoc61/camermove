import type { Kafka } from "kafkajs"
import type { Env } from "@camermove/config"
import { createLogger } from "@camermove/config"
import type { EventTopic } from "./topics"
import type { DomainEvent } from "./types"

const log = createLogger()

export function createEventProducer(kafka: Kafka, env: Env) {
  void env
  const producer = kafka.producer({ idempotent: true })
  return {
    async connect() {
      await producer.connect()
    },
    async publish<T>(topic: EventTopic, event: DomainEvent<T>) {
      await producer.send({
        topic,
        messages: [{ key: event.aggregateId, value: JSON.stringify(event) }],
      })
      log.info({ topic, id: event.id }, "event published")
    },
    async disconnect() {
      await producer.disconnect()
    },
  }
}

export type EventProducer = ReturnType<typeof createEventProducer>

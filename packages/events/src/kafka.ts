import { Kafka } from "kafkajs"
import type { Env } from "@camermove/config"

export function createKafkaClient(env: Env) {
  return new Kafka({
    clientId: "camermove",
    brokers: env.KAFKA_BROKERS.split(","),
  })
}

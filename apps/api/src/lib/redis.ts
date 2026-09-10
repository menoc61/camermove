import IORedis from "ioredis"
import { createLogger, loadEnv } from "@camermove/config"

const log = createLogger()

let client: IORedis | null = null

export function getRedis(): IORedis {
  if (client) return client
  const env = loadEnv()
  client = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  })
  client.on("error", (err: Error) => log.warn({ err: err.message }, "redis error"))
  return client
}

export async function closeRedis() {
  if (client) {
    await client.quit()
    client = null
  }
}

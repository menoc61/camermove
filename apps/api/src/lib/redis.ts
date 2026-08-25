import IORedis from "ioredis"
import { loadEnv } from "@camermove/config"

let client: IORedis | null = null

export function getRedis(): IORedis {
  if (client) return client
  const env = loadEnv()
  client = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  })
  client.on("error", (err: Error) => console.warn("redis error", err.message))
  return client
}

export async function closeRedis() {
  if (client) {
    await client.quit()
    client = null
  }
}

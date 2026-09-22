import IORedis from "ioredis"
import { createLogger, loadEnv } from "@camermove/config"

const log = createLogger()

let client: IORedis | null = null

/** Single shared Redis client for the whole monorepo (rate limiting, cache,
 * idempotency, webhooks dedup, settings cache). Memory fallback lives one
 * layer up — this adapter only owns connection lifecycle. */
export function getSharedRedis(): IORedis {
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

export async function closeSharedRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => client?.disconnect())
    client = null
  }
}

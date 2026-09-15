// Single shared Redis client lives in @camermove/db — this module re-exports
// it for API-local call sites (rate limiting, idempotency, webhook dedup, cache).
import { getSharedRedis, closeSharedRedis } from "@camermove/db"

export const getRedis = getSharedRedis
export const closeRedis = closeSharedRedis

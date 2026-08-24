import fp from "fastify-plugin"
import type { FastifyInstance } from "fastify"
import { getRedis } from "../lib/redis"
import { loadEnv } from "@camermove/config"

// Dual-layer rate limiting: IP-based + app-wide.
// - IP layer: per-client IP per route (e.g., 10/min for auth, 30/min search, 100/min general)
// - App layer: global per route across all IPs (e.g., 1000/min for search, 5000/min general) — protects origin from abuse/burst.
// Uses Redis (shared across instances, horizontal-scale safe) with in-memory fallback for dev.

const memoryBuckets = new Map<string, { count: number; resetAt: number }>()

function isLimitedMemory(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const b = memoryBuckets.get(key)
  if (!b || now > b.resetAt) { memoryBuckets.set(key, { count: 1, resetAt: now + windowMs }); return false }
  if (b.count >= max) return true
  b.count++
  return false
}

async function isLimitedRedis(key: string, max: number, windowMs: number): Promise<boolean> {
  try {
    const redis = getRedis()
    const now = Date.now()
    const ttl = Math.ceil(windowMs / 1000)
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, ttl)
    const remaining = await redis.ttl(key)
    if (remaining < 0) await redis.expire(key, ttl)
    return count > max
  } catch {
    return isLimitedMemory(key, max, windowMs)
  }
}

export const rateLimitPlugin = fp(async (app: FastifyInstance) => {
  const env = loadEnv()
  app.addHook("preHandler", async (req, reply) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? "unknown"
    const path = req.url.split("?")[0] ?? ""
    const windowMs = env.RATE_LIMIT_WINDOW_MS

    // Per-IP limits — from .env (no hardcoded values)
    let ipMax = env.RATE_LIMIT_IP_GENERAL_MAX
    if (path.startsWith("/api/v1/auth")) ipMax = env.RATE_LIMIT_IP_AUTH_MAX
    else if (path.startsWith("/api/v1/search")) ipMax = env.RATE_LIMIT_IP_SEARCH_MAX

    // App-wide limits — from .env
    let appMax = env.RATE_LIMIT_APP_GENERAL_MAX
    if (path.startsWith("/api/v1/search")) appMax = env.RATE_LIMIT_APP_SEARCH_MAX
    else if (path.startsWith("/api/v1/auth")) appMax = env.RATE_LIMIT_APP_AUTH_MAX

    const ipKey = `rl:ip:${ip}:${path}`
    const appKey = `rl:app:${path}`

    const [ipLimited, appLimited] = await Promise.all([
      isLimitedRedis(ipKey, ipMax, windowMs),
      isLimitedRedis(appKey, appMax, windowMs),
    ])

    if (ipLimited) {
      reply.header("Retry-After", "60")
      return reply.code(429).send({ error: "RATE_LIMITED_IP", message: "Trop de requêtes depuis votre IP, réessayez dans 60s" })
    }
    if (appLimited) {
      reply.header("Retry-After", "60")
      return reply.code(429).send({ error: "RATE_LIMITED_APP", message: "Service temporairement saturé, réessayez plus tard" })
    }
  })
})

setInterval(() => {
  const now = Date.now()
  for (const [k, v] of memoryBuckets) if (now > v.resetAt) memoryBuckets.delete(k)
}, 60_000).unref?.()

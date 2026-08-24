import { getRedis } from "./redis"

const DEFAULT_TTL = 60 // seconds

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedis()
    const raw = await redis.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function setCached(key: string, value: unknown, ttl = DEFAULT_TTL): Promise<void> {
  try {
    const redis = getRedis()
    await redis.setex(key, ttl, JSON.stringify(value))
  } catch {}
}

export async function invalidateCache(pattern: string): Promise<void> {
  try {
    const redis = getRedis()
    const keys = await redis.keys(pattern)
    if (keys.length > 0) await redis.del(...keys)
  } catch {}
}

export function cacheKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${String(params[k])}`)
    .join("&")
  return `${prefix}:${sorted}`
}

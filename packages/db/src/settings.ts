import IORedis from "ioredis"
import { createLogger, loadEnv } from "@camermove/config"
import { prisma } from "./prisma"
import { getSharedRedis } from "./redis"
import type { AppSettings } from "@prisma/client"

const log = createLogger()

export const APP_SETTINGS_CACHE_KEY = "appsettings:global"
const DEFAULT_TTL_SECONDS = 30 // per AGENTS.md §5

/** Minimal shape callers rely on (row or fallback defaults). */
export interface AppSettingsCached {
  commissionPercent: unknown
  holdExpiryMinutes: number
  featureFlags: unknown
}

// Process-local fast path (also the only cache layer in test env).
const memoryCache = new Map<string, { value: unknown; expiresAt: number }>()

function isTestEnv(): boolean {
  // Single source of truth via loadEnv(). No direct process.env reads.
  return loadEnv().NODE_ENV === "test"
}

function toCached(settings: AppSettings): AppSettingsCached {
  return {
    commissionPercent: settings.commissionPercent,
    holdExpiryMinutes: settings.holdExpiryMinutes,
    featureFlags: settings.featureFlags,
  }
}

function getRedis(): IORedis | null {
  if (isTestEnv()) return null
  return getSharedRedis()
}

/**
 * Single shared AppSettings loader (AGENTS.md §5).
 * Order: memory → Redis (`appsettings:global`, `ttlSeconds`) → Postgres
 * (`appSettings.findUnique`, lazy-create singleton row) → hardcoded defaults.
 * Returns the settings row, or fallback defaults if the DB is unavailable.
 */
export async function getAppSettingsCached(ttlSeconds = DEFAULT_TTL_SECONDS): Promise<AppSettingsCached> {
  const mem = memoryCache.get(APP_SETTINGS_CACHE_KEY)
  if (mem && mem.expiresAt > Date.now()) {
    return mem.value as AppSettingsCached
  }
  const client = getRedis()
  if (client) {
    try {
      const raw = await client.get(APP_SETTINGS_CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as AppSettingsCached
        memoryCache.set(APP_SETTINGS_CACHE_KEY, { value: parsed, expiresAt: Date.now() + ttlSeconds * 1000 })
        return parsed
      }
    } catch (err) {
      log.warn({ err: (err as Error).message }, "db settings cache read failed")
    }
  }
  let settings = await prisma.appSettings.findUnique({ where: { id: "global" } })
  if (!settings) {
    // create default row lazily if missing
    try {
      settings = await prisma.appSettings.create({ data: { id: "global" } })
    } catch {
      settings = await prisma.appSettings.findUnique({ where: { id: "global" } })
    }
  }
  if (settings) {
    const value = toCached(settings)
    memoryCache.set(APP_SETTINGS_CACHE_KEY, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
    if (client) {
      await client.setex(APP_SETTINGS_CACHE_KEY, ttlSeconds, JSON.stringify(settings)).catch((err: unknown) => {
        log.warn({ err: (err as Error).message }, "db settings cache write failed")
      })
    }
    return value
  }
  // fallback defaults if DB unavailable
  return { commissionPercent: 10, holdExpiryMinutes: 15, featureFlags: {} }
}

/** Test/maintenance escape hatch: drop the process-local entry AND the shared
 * Redis entry — otherwise another instance (or a later call in the same
 * process) would immediately re-populate memory from the stale Redis value. */
export async function __clearSettingsCache(): Promise<void> {
  memoryCache.delete(APP_SETTINGS_CACHE_KEY)
  const client = getRedis()
  if (client) {
    try {
      await client.del(APP_SETTINGS_CACHE_KEY)
    } catch (err) {
      log.warn({ err: (err as Error).message }, "db settings cache clear failed")
    }
  }
}
import { prisma } from "@camermove/db"
import { calcCommission } from "@camermove/shared"
import { getCached, setCached } from "../lib/cache.js"

const CACHE_KEY = "appsettings:global"
const CACHE_TTL = 30 // seconds per AGENTS.md §5

export async function getAppSettingsCached() {
  try {
    const cached = await getCached<Record<string, unknown>>(CACHE_KEY)
    if (cached) return cached as unknown as { commissionPercent: unknown; holdExpiryMinutes: number; featureFlags: unknown }
  } catch {}
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
    await setCached(CACHE_KEY, settings, CACHE_TTL).catch(() => {})
    return settings
  }
  // fallback defaults if DB unavailable
  return { commissionPercent: 10, holdExpiryMinutes: 15, featureFlags: {} } as never
}

export async function computeCommission(
  grossAmount: number,
  transporterId: string,
): Promise<{ commissionAmount: number; netAmount: number; percentApplied: number }> {
  const settings: any = await getAppSettingsCached()
  const globalPct = Number(settings.commissionPercent ?? 10)
  const overrides = (settings.featureFlags as Record<string, unknown> | null)?.transporterCommissions as Record<string, number> | undefined
  const pct = overrides && typeof overrides[transporterId] === "number" ? overrides[transporterId]! : globalPct
  return calcCommission(grossAmount, pct)
}

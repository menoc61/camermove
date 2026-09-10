import { getAppSettingsCached } from "@camermove/db"
import { calcCommission } from "@camermove/shared"

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

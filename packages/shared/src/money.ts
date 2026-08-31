/**
 * Integer XAF money helpers — shared via packages/shared per AGENTS.md §4.
 * Uses Math.round integer math, never floating *0.1.
 */

export function calcCommission(
  gross: number,
  percent: number,
): { commissionAmount: number; netAmount: number; percentApplied: number } {
  const commissionAmount = Math.round((gross * percent) / 100)
  const netAmount = gross - commissionAmount
  return { commissionAmount, netAmount, percentApplied: percent }
}

export function calcRefund(
  gross: number,
  refundPercent: number,
): number {
  return Math.round((gross * refundPercent) / 100)
}

export function priceXaf(n: number): string {
  return `${new Intl.NumberFormat("fr-CM").format(n).replace(/\u202f/g, " ")} XAF`
}

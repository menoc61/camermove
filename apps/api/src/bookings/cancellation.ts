import { prisma } from "@camermove/db"

export type CancelActor = "traveler" | "transporter" | "admin" | "super_admin" | "system"
export type CancelResult = {
  allowed: boolean
  reason?: string
  refundPercent: number
  refundAmount: number
  feeAmount: number
  feePercent: number
  tier: string
  policy: string
}

// Structured tiers stored in AppSettings.featureFlags.cancellationTiers or fallback to defaults
export interface CancellationTier {
  tier: string
  minHoursBeforeDeparture: number // exclusive lower bound
  maxHoursBeforeDeparture: number // inclusive upper bound (Infinity for >24)
  refundPercent: number // 0..100, of grossAmount
  feePercent: number // 0..100, of grossAmount deducted as fee
  allowed: boolean
  label: string
}

export const DEFAULT_TIERS: CancellationTier[] = [
  { tier: "full", minHoursBeforeDeparture: 24, maxHoursBeforeDeparture: Infinity, refundPercent: 100, feePercent: 0, allowed: true, label: ">24h — remboursement intégral" },
  { tier: "seventyFive", minHoursBeforeDeparture: 12, maxHoursBeforeDeparture: 24, refundPercent: 75, feePercent: 5, allowed: true, label: "12–24h — 75% remboursé, 5% frais" },
  { tier: "fifty", minHoursBeforeDeparture: 1, maxHoursBeforeDeparture: 12, refundPercent: 50, feePercent: 10, allowed: true, label: "1–12h — 50% remboursé, 10% frais" },
  { tier: "none", minHoursBeforeDeparture: 0, maxHoursBeforeDeparture: 1, refundPercent: 0, feePercent: 0, allowed: false, label: "<1h — non remboursable, annulation refusée" },
  { tier: "departed", minHoursBeforeDeparture: -Infinity, maxHoursBeforeDeparture: 0, refundPercent: 0, feePercent: 0, allowed: false, label: "Départ passé — non annulable (no-show)" },
]

export async function getCancellationTiers(): Promise<CancellationTier[]> {
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: "global" } })
    const flags = settings?.featureFlags as Record<string, unknown> | null
    const tiers = (flags?.cancellationTiers as CancellationTier[] | undefined)
    if (Array.isArray(tiers) && tiers.length > 0) return tiers
  } catch {}
  return DEFAULT_TIERS
}

export async function evaluateCancellation(input: {
  booking: { id: string; status: string; totalAmount: number; tripId: string; userId: string; createdAt: Date }
  trip: { departureAt: Date; status: string; cancellationPolicy?: string | null }
  actor: CancelActor
  actorId: string
  transporterId?: string | null
}): Promise<CancelResult> {
  const now = new Date()
  const hoursBefore = (input.trip.departureAt.getTime() - now.getTime()) / 36e5

  // --- Hard blocks (probabilities that always deny or special-case) ---

  // Already terminal
  if (["cancelled", "refunded", "expired"].includes(input.booking.status)) {
    return { allowed: false, reason: `Réservation déjà ${input.booking.status}`, refundPercent: 0, refundAmount: 0, feeAmount: 0, feePercent: 0, tier: "terminal", policy: "État terminal" }
  }

  // Hold not yet paid — system expiry vs traveler cancel
  if (input.booking.status === "pending_payment") {
    if (input.actor === "system") {
      return { allowed: true, refundPercent: 0, refundAmount: 0, feeAmount: 0, feePercent: 0, tier: "hold-expiry", policy: "Hold expiré — places libérées, aucun remboursement (paiement non effectué)" }
    }
    // Traveler cancels pending hold — always allowed, no refund needed, just release
    return { allowed: true, refundPercent: 0, refundAmount: 0, feeAmount: 0, feePercent: 0, tier: "hold-cancel", policy: "Annulation hold — places libérées" }
  }

  // Ticket already used/void
  const tickets = await prisma.ticket.findMany({ where: { bookingId: input.booking.id } })
  if (tickets.some((t: any) => t.status === "used")) {
    return { allowed: false, reason: "Billet déjà utilisé", refundPercent: 0, refundAmount: 0, feeAmount: 0, feePercent: 0, tier: "used", policy: "Billet utilisé — non remboursable" }
  }

  // Trip already departed / no-show
  if (hoursBefore <= 0) {
    return { allowed: false, reason: "Départ déjà effectué (no-show)", refundPercent: 0, refundAmount: 0, feeAmount: 0, feePercent: 0, tier: "departed", policy: DEFAULT_TIERS.find((t) => t.tier === "departed")!.label }
  }

  // Trip cancelled by transporter — always full refund, no fee, regardless of time
  if (input.trip.status === "cancelled" || input.trip.status === "inactive") {
    return { allowed: true, refundPercent: 100, refundAmount: input.booking.totalAmount, feeAmount: 0, feePercent: 0, tier: "transporter-cancel", policy: "Transporteur a annulé — remboursement intégral" }
  }

  // Actor-specific overrides
  if (input.actor === "admin" || input.actor === "super_admin") {
    // Admin can always cancel (force), with full refund by default — fee waived
    return { allowed: true, refundPercent: 100, refundAmount: input.booking.totalAmount, feeAmount: 0, feePercent: 0, tier: "admin-force", policy: "Annulation admin — remboursement intégral (frais offerts)" }
  }

  if (input.actor === "transporter" && input.transporterId) {
    // Transporter cancelling own trip's booking — full refund, no fee
    return { allowed: true, refundPercent: 100, refundAmount: input.booking.totalAmount, feeAmount: 0, feePercent: 0, tier: "transporter-cancel", policy: "Annulation transporteur — remboursement intégral" }
  }

  // Ownership check for traveler (already enforced at route, but double-check)
  if (input.actor === "traveler" && input.booking.userId !== input.actorId) {
    return { allowed: false, reason: "Non autorisé", refundPercent: 0, refundAmount: 0, feeAmount: 0, feePercent: 0, tier: "forbidden", policy: "Non propriétaire" }
  }

  // --- Time-tiered policy for traveler (normal case) ---
  const tiers = await getCancellationTiers()
  // Per-trip override: if trip.cancellationPolicy is a JSON string with tiers, use it
  let effectiveTiers = tiers
  if (input.trip.cancellationPolicy) {
    try {
      const parsed = JSON.parse(input.trip.cancellationPolicy)
      if (Array.isArray(parsed) && parsed.length > 0) effectiveTiers = parsed as CancellationTier[]
    } catch {
      // treat as label, keep default tiers
    }
  }

  const tier = effectiveTiers.find((t) => hoursBefore > t.minHoursBeforeDeparture && hoursBefore <= t.maxHoursBeforeDeparture) ?? effectiveTiers[effectiveTiers.length - 1]!

  if (!tier.allowed) {
    return { allowed: false, reason: tier.label, refundPercent: 0, refundAmount: 0, feeAmount: 0, feePercent: tier.feePercent, tier: tier.tier, policy: tier.label }
  }

  const refundAmount = Math.round((input.booking.totalAmount * tier.refundPercent) / 100)
  const feeAmount = Math.round((input.booking.totalAmount * tier.feePercent) / 100)

  return { allowed: true, refundPercent: tier.refundPercent, refundAmount, feeAmount, feePercent: tier.feePercent, tier: tier.tier, policy: tier.label }
}

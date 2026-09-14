import { fetchLandingRail } from "@/lib/api/landing"
import { ServiceRail, ServiceRailCard } from "../ServiceRail"

// Fallback prices (XAF per traveler) — mirrors
// apps/api/src/insurance/service.ts DEFAULT_COVERAGE_PRICES.
// The authoritative pricing is served by GET /api/v1/landing/rails?type=insurance.
const DEFAULT_COVERAGE_PRICES: Record<string, number> = {
  basic: 2500,
  standard: 5000,
  premium: 10000,
  family: 15000,
}

const formatXaf = (v: number) => new Intl.NumberFormat("fr-FR").format(v)

const COVERAGES = [
  {
    key: "basic",
    name: "Essentielle",
    detail: "Bagages, retards, assistance de base",
    image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=800&auto=format&fit=crop",
    imageAlt: "Voyageuse consultant une carte",
  },
  {
    key: "standard",
    name: "Standard",
    detail: "Annulation, santé, rapatriement",
    image: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=800&auto=format&fit=crop",
    imageAlt: "Aile d'avion au-dessus des nuages",
  },
  {
    key: "premium",
    name: "Premium",
    detail: "Tous risques, plafonds étendus, conciergerie",
    image: "https://images.unsplash.com/photo-1500835556837-99ac94a94552?q=80&w=800&auto=format&fit=crop",
    imageAlt: "Vue depuis le hublot d'un avion",
  },
  {
    key: "family",
    name: "Famille",
    detail: "Jusqu'à 6 voyageurs, enfants couverts",
    image: "https://images.unsplash.com/photo-1530789253388-582c481c54b0?q=80&w=800&auto=format&fit=crop",
    imageAlt: "Famille en voyage",
  },
] as const

/**
 * InsuranceRail — 06. Coverage cards with server-resolved pricing.
 * Fetches via public GET /api/v1/landing/rails?type=insurance.
 */
export async function InsuranceRail() {
  let pricing: Record<string, number> = { ...DEFAULT_COVERAGE_PRICES }
  try {
    const payload = await fetchLandingRail("insurance")
    if (payload.pricing) pricing = { ...DEFAULT_COVERAGE_PRICES, ...payload.pricing }
  } catch {
    // API unavailable — fall back to DEFAULT_COVERAGE_PRICES
  }

  return (
    <ServiceRail
      index="06"
      kicker="Assurance voyage"
      title="Partez couvert, revenez léger."
      intro="Quatre couvertures, un seul compte, une prime affichée avant de payer."
      href="/insurance"
      hrefLabel="Voir les couvertures"
    >
      {COVERAGES.map((c) => (
        <ServiceRailCard
          key={c.key}
          href="/insurance"
          image={c.image}
          imageAlt={c.imageAlt}
          top="Europe · 14 jours"
          title={`${c.name} — ${c.detail}`}
          bottom={`Prime dès ${formatXaf(pricing[c.key] ?? DEFAULT_COVERAGE_PRICES[c.key] ?? 2500)} XAF`}
          badge={c.key === "standard" ? "La plus choisie" : undefined}
        />
      ))}
    </ServiceRail>
  )
}

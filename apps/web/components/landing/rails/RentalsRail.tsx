import { fetchLandingRail } from "@/lib/api/landing"
import { ServiceRail, ServiceRailCard } from "../ServiceRail"

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1200&q=70"

/**
 * RentalsRail — 03. 8 available vehicles, cheapest first.
 * Fetches via public GET /api/v1/landing/rails?type=rentals.
 * Renders nothing when empty.
 */
export async function RentalsRail() {
  let vehicles: Array<{
    id: string
    title: string
    top: string
    bottom: string
    image: string
  }> = []

  try {
    const payload = await fetchLandingRail("rentals")
    vehicles = (payload.items ?? []).map((v) => ({
      ...v,
      image: v.image || FALLBACK_IMAGE,
    }))
  } catch {
    return null
  }

  if (vehicles.length === 0) return null

  return (
    <ServiceRail
      index="04"
      kicker="Location de véhicules"
      title="La route, à votre rythme."
      intro="Citadines, SUV, minibus — avec ou sans chauffeur, au départ des grandes villes. Assurance incluse, prix affichés sans surprise."
      href="/rentals"
      hrefLabel="Louer un véhicule"
    >
      {vehicles.map((v) => (
        <ServiceRailCard
          key={v.id}
          href={`/rentals/${v.id}`}
          image={v.image}
          imageAlt={`${v.title} — ${v.top}`}
          top={v.top}
          title={v.title}
          bottom={v.bottom}
        />
      ))}
    </ServiceRail>
  )
}

import { fetchLandingRail } from "@/lib/api/landing"
import { priceXaf } from "@camermove/shared"
import { ServiceRail, ServiceRailCard } from "../ServiceRail"

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=70"

/**
 * HotelsRail — 02. Top 8 active, approved hotels with rooms,
 * ordered by star rating. Fetches via public GET /api/v1/landing/rails?type=hotels.
 * Renders nothing when empty.
 */
export async function HotelsRail() {
  let hotels: Array<{
    id: string
    name: string
    city: string
    starRating: number | null
    image: string
    fromPrice: number | null
  }> = []

  try {
    const payload = await fetchLandingRail("hotels")
    hotels = (payload.items ?? []).map((h) => ({
      ...h,
      image: h.image || FALLBACK_IMAGE,
    }))
  } catch {
    return null
  }

  if (hotels.length === 0) return null

  return (
    <ServiceRail
      index="03"
      kicker="Hôtels & hébergements"
      title="Dormez bien, où que vous alliez."
      intro="Hôtels et appartements vérifiés dans tout le Cameroun, du studio meublé à la suite familiale. Réservez avec le même compte."
      href="/hotels"
      hrefLabel="Voir les hébergements"
    >
      {hotels.map((h) => (
        <ServiceRailCard
          key={h.id}
          href={`/hotels/${h.id}`}
          image={h.image}
          imageAlt={`${h.name} — ${h.city}`}
          top={h.starRating ? `${h.city} · ${h.starRating}★` : h.city}
          title={h.name}
          bottom={`dès ${priceXaf(h.fromPrice as number)} / nuit`}
        />
      ))}
    </ServiceRail>
  )
}

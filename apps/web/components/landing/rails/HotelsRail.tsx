import { prisma } from "@camermove/db"
import { ServiceRail, ServiceRailCard } from "../ServiceRail"

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=70"

function priceFr(n: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(n)} XAF`
}

/**
 * HotelsRail — 02. Top 8 active, approved hotels with rooms,
 * ordered by star rating. Renders nothing when empty.
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
    const rows = await prisma.hotel.findMany({
      where: {
        status: "active",
        partnerStatus: "approved",
        rooms: { some: {} },
      },
      orderBy: { starRating: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        city: true,
        starRating: true,
        photos: true,
        rooms: { select: { pricePerNight: true } },
      },
    })
    hotels = rows
      .map((h) => ({
        id: h.id,
        name: h.name,
        city: h.city,
        starRating: h.starRating,
        image: h.photos[0] ?? FALLBACK_IMAGE,
        fromPrice:
          h.rooms.length > 0
            ? Math.min(...h.rooms.map((r) => r.pricePerNight))
            : null,
      }))
      .filter((h) => h.fromPrice != null)
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
          bottom={`dès ${priceFr(h.fromPrice as number)} / nuit`}
        />
      ))}
    </ServiceRail>
  )
}

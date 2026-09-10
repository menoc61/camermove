import { prisma } from "@camermove/db"
import { ServiceRail, ServiceRailCard } from "../ServiceRail"

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1200&q=70"

const UNIT_LABEL: Record<string, string> = {
  hour: "heure",
  day: "jour",
  week: "semaine",
  month: "mois",
}

function priceFr(n: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(n)} XAF`
}

/**
 * RentalsRail — 03. 8 available vehicles, cheapest first.
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
    const rows = await prisma.rentalVehicle.findMany({
      where: { status: "available" },
      orderBy: { pricePerUnit: "asc" },
      take: 8,
    })
    vehicles = rows.map((v) => ({
      id: v.id,
      title: v.year ? `${v.make} ${v.model} · ${v.year}` : `${v.make} ${v.model}`,
      top: `${v.pickupCity} · ${v.category}`,
      bottom: `${priceFr(v.pricePerUnit)} / ${UNIT_LABEL[v.durationUnit] ?? "jour"} · ${v.hasDriver ? "avec chauffeur" : "sans chauffeur"}`,
      image: v.photos[0] ?? FALLBACK_IMAGE,
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

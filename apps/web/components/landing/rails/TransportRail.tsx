import { prisma } from "@camermove/db"
import { ServiceRail, ServiceRailCard } from "../ServiceRail"

/* Rotating per-transporter bus imagery (Unsplash, stable IDs). */
const BUS_IMAGES = [
  "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1494515843206-f3117d3f51b7?auto=format&fit=crop&w=1200&q=70",
]

function timeFr(d: Date): string {
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Douala",
  })
}

function priceFr(n: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(n)} XAF`
}

/**
 * TransportRail — 01, dark hero rail. Next 8 active trips with seats.
 * Server component: queries prisma directly. Renders nothing when empty.
 */
export async function TransportRail() {
  let trips: Array<{
    id: string
    departureAt: Date
    price: number
    vehicleTypeInfo: string | null
    seatsAvailable: number
    origin: string
    destination: string
    companyName: string
  }> = []

  try {
    const rows = await prisma.trip.findMany({
      where: {
        status: "active",
        departureAt: { gte: new Date() },
        seatAvailability: { seatsAvailable: { gte: 1 } },
      },
      orderBy: { departureAt: "asc" },
      take: 8,
      include: {
        route: { select: { originCity: true, destinationCity: true } },
        transport: { select: { companyName: true } },
        seatAvailability: true,
      },
    })
    trips = rows.map((t) => ({
      id: t.id,
      departureAt: t.departureAt,
      price: t.price,
      vehicleTypeInfo: t.vehicleTypeInfo,
      seatsAvailable: t.seatAvailability?.seatsAvailable ?? 0,
      origin: t.route.originCity,
      destination: t.route.destinationCity,
      companyName: t.transport.companyName,
    }))
  } catch {
    return null
  }

  if (trips.length === 0) return null

  const minPrice = Math.min(...trips.map((t) => t.price))
  const heroIndex = trips.findIndex((t) => t.price === minPrice)

  return (
    <ServiceRail
      index="02"
      kicker="Transport interurbain"
      title="L'interurbain, sans la file d'attente."
      intro="Départs quotidiens Yaoundé ⇄ Douala et vers toutes les grandes villes. Sièges climatisés, paiement Mobile Money, embarquement prioritaire."
      href="/results?origin=Yaound%C3%A9&destination=Douala&pax=1"
      hrefLabel="Voir tous les trajets"
      dark
    >
      {trips.map((t, i) => (
        <ServiceRailCard
          key={t.id}
          href={`/trips/${t.id}`}
          image={BUS_IMAGES[i % BUS_IMAGES.length] as string}
          imageAlt={`${t.companyName} — bus ${t.origin} vers ${t.destination}`}
          top={`${t.origin} → ${t.destination} · ${timeFr(t.departureAt)}`}
          title={t.vehicleTypeInfo ? `${t.companyName} · ${t.vehicleTypeInfo}` : t.companyName}
          bottom={`${priceFr(t.price)} · ${t.seatsAvailable} places`}
          badge={i === heroIndex ? "Héros" : undefined}
        />
      ))}
    </ServiceRail>
  )
}

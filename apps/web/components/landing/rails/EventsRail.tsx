import { fetchLandingRail } from "@/lib/api/landing"
import { priceXaf } from "@camermove/shared"
import { ServiceRail, ServiceRailCard } from "../ServiceRail"

const FALLBACK_POSTER =
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800&auto=format&fit=crop"

const formatDayMonth = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(iso))

/**
 * EventsRail — 07. Next 8 on-sale, approved events.
 * Fetches via public GET /api/v1/landing/rails?type=events.
 */
export async function EventsRail() {
  let events: Array<{
    id: string
    name: string
    city: string
    startDate: string
    posterUrl: string | null
    minPrice: number | null
  }> = []
  try {
    const payload = await fetchLandingRail("events")
    events = payload.items ?? []
  } catch {
    return null
  }

  if (events.length === 0) return null

  return (
    <ServiceRail
      index="07"
      kicker="Billetterie événements"
      title="Le week-end commence ici."
      intro="Concerts, matchs, festivals — billets vérifiés, QR à l'entrée, remboursement si annulé."
      href="/events"
      hrefLabel="Tous les événements"
    >
      {events.map((e) => (
        <ServiceRailCard
          key={e.id}
          href={`/events/${e.id}`}
          image={e.posterUrl ?? FALLBACK_POSTER}
          imageAlt={`Affiche de l'événement ${e.name}`}
          top={`${e.city} · ${formatDayMonth(e.startDate)}`}
          title={e.name}
          bottom={e.minPrice != null ? `dès ${priceXaf(e.minPrice)}` : "Billetterie ouverte"}
        />
      ))}
    </ServiceRail>
  )
}

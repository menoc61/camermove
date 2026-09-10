import { prisma } from "@camermove/db"
import { ServiceRail, ServiceRailCard } from "../ServiceRail"

const FALLBACK_POSTER =
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800&auto=format&fit=crop"

const formatXaf = (v: number) => new Intl.NumberFormat("fr-FR").format(v)

const formatDayMonth = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(d)

export async function EventsRail() {
  let events: Array<{
    id: string
    name: string
    city: string
    startDate: Date
    posterUrl: string | null
    ticketCategories: Array<{ price: number }>
  }> = []
  try {
    events = await prisma.event.findMany({
      where: {
        status: "on_sale",
        partnerStatus: "approved",
        startDate: { gte: new Date() },
      },
      orderBy: { startDate: "asc" },
      take: 8,
      select: {
        id: true,
        name: true,
        city: true,
        startDate: true,
        posterUrl: true,
        ticketCategories: { select: { price: true } },
      },
    })
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
      {events.map((e) => {
        const prices = e.ticketCategories.map((c) => c.price).filter((p) => Number.isFinite(p))
        const min = prices.length > 0 ? Math.min(...prices) : null
        return (
          <ServiceRailCard
            key={e.id}
            href={`/events/${e.id}`}
            image={e.posterUrl ?? FALLBACK_POSTER}
            imageAlt={`Affiche de l'événement ${e.name}`}
            top={`${e.city} · ${formatDayMonth(e.startDate)}`}
            title={e.name}
            bottom={min != null ? `dès ${formatXaf(min)} XAF` : "Billetterie ouverte"}
          />
        )
      })}
    </ServiceRail>
  )
}

"use client"
/**
 * Dashboard â€” client view of the traveler dashboard. Receives the data
 * fetched by the RSC wrapper and renders 3 sections: Upcoming, Tickets,
 * History (collapsible). React Query drives refetch + retry.
 *
 * Per UI-SPEC: max 3 cards per section + "Voir tous" link when >3.
 * History section hidden when empty (no EmptyState).
 * Empty Upcoming shows "Aucun voyage Ã  venir" + CTA "Rechercher" â†’ /.
 * Empty Tickets shows "Vos billets apparaÃ®tront ici aprÃ¨s paiement." (no CTA).
 */
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import type { DashboardResponse } from "../../lib/api/dashboard"
import { getDashboard } from "../../lib/api/dashboard"
import { EmptyState } from "./EmptyState"
import { HistoryToggle } from "./HistoryToggle"
import { SkeletonCard } from "./SkeletonCard"
import { TicketCard } from "./TicketCard"
import { UpcomingTripCard } from "./UpcomingTripCard"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

const VISIBLE_LIMIT = 3

export function Dashboard({
  initialData,
  token,
}: {
  initialData: DashboardResponse
  token: string
}) {
  const { data, error, isFetching, refetch } = useQuery<DashboardResponse>({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(token),
    initialData,
  })

  if (!data) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  const upcoming = data.upcoming ?? []
  const tickets = data.tickets ?? []
  const history = data.history ?? []

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            Impossible de charger vos voyages. RÃ©essayez.
            <Button variant="outline" size="sm" onClick={() => refetch()} className="w-fit">
              RÃ©essayer
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Upcoming trips */}
      <section>
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Voyages Ã  venir</h2>
          {upcoming.length > VISIBLE_LIMIT ? (
            <Link href="/dashboard?section=upcoming" className="text-xs font-medium text-primary">
              Voir tous
            </Link>
          ) : null}
        </header>
        {upcoming.length === 0 ? (
          <EmptyState
            title="Aucun voyage Ã  venir. Trouvez un trajet."
            cta={{ href: "/", label: "Rechercher" }}
          />
        ) : (
          <div className="space-y-3">
            {upcoming.slice(0, VISIBLE_LIMIT).map((item) => (
              <UpcomingTripCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* Tickets */}
      <section>
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Billets</h2>
          {tickets.length > VISIBLE_LIMIT ? (
            <Link href="/dashboard?section=tickets" className="text-xs font-medium text-primary">
              Voir tous
            </Link>
          ) : null}
        </header>
        {tickets.length === 0 ? (
          <EmptyState title="Vos billets apparaÃ®tront ici aprÃ¨s paiement." />
        ) : (
          <div className="space-y-3">
            {tickets.slice(0, VISIBLE_LIMIT).map((item) => (
              <TicketCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* History â€” collapsed, hidden entirely when empty */}
      {history.length > 0 ? (
        <HistoryToggle count={history.length}>
          {history.map((item) => (
            <UpcomingTripCard key={item.id} item={item} />
          ))}
        </HistoryToggle>
      ) : null}

      {isFetching ? <p className="text-xs text-slate-400">Mise Ã  jourâ€¦</p> : null}
    </div>
  )
}

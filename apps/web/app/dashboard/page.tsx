import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardShell } from "@/components/dashboard-v2/layout/DashboardShell"
import { DashboardV2 } from "@/components/dashboard-v2/DashboardV2"
import { getDashboard } from "@/lib/api/dashboard"
import { ApiError } from "@/lib/api/client"
import type { DashboardResponse } from "@/lib/api/dashboard"
import { UpcomingTripCard } from "@/components/dashboard-v2/cards/UpcomingTripCard"
import { Button } from "@/components/ui/button"
import { ArrowRight, MapPin, Search, Ticket, Wallet } from "lucide-react"

export const dynamic = "force-dynamic"

/**
 * The single client dashboard — v1 and v2 merged here (the old
 * components/dashboard implementation was removed as duplicate).
 *
 * Composition:
 *   1. Hero strip with the next upcoming trip (uses the UpcomingTripCard)
 *   2. Quick-action tiles (search, ticket lookup, billing, profile)
 *   3. DashboardV2 → SummaryGrid + DashboardTabs (10 tabs, exports, pagination)
 */
async function DashboardInner() {
  const h = await headers()
  const c = await cookies()
  const token = h.get("x-cm-user-token") ?? c.get("cm_access")?.value ?? null
  if (!token) redirect("/login?next=/dashboard")

  let data: DashboardResponse
  try {
    data = await getDashboard(token)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login?next=/dashboard")
    }
    data = { upcoming: [], history: [], tickets: [] } as DashboardResponse
  }

  const next = data.upcoming[0] ?? null

  return (
    <div className="flex flex-col gap-6">
      {/* Hero strip — next upcoming trip */}
      <section
        aria-label="Prochain trajet"
        className="overflow-hidden rounded-2xl border bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900 p-5 text-white shadow-sm"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
              Bonjour · Bienvenue sur votre tableau de bord
            </p>
            <h1 className="text-xl font-semibold leading-tight sm:text-2xl">
              {next
                ? `Prochain départ : ${next.origin} → ${next.destination}`
                : "Aucun voyage à venir. Explorez les agences et lignes urbaines."}
            </h1>
            <p className="text-sm text-white/70">
              {next
                ? `Départ le ${new Date(next.departureAt).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}`
                : "Comparez les compagnies, notez vos trajets, rechargez votre carte Tap&Go."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/results?origin=Yaound%C3%A9&destination=Douala&pax=1">
              <Button size="sm" variant="secondary" className="rounded-full">
                <Search className="mr-1 size-4" /> Rechercher
              </Button>
            </Link>
            <Link href="/intraurban">
              <Button size="sm" variant="outline" className="rounded-full bg-transparent border-white/30 text-white hover:bg-white/10">
                <MapPin className="mr-1 size-4" /> Bus urbains
              </Button>
            </Link>
          </div>
        </div>

        {next && (
          <div className="mt-5">
            <UpcomingTripCard item={next} />
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction href="/tickets/lookup" icon={<Ticket className="size-4" />} title="Retrouver un billet" desc="Par référence" />
        <QuickAction href="/results?origin=Yaound%C3%A9&destination=Douala&pax=1" icon={<Search className="size-4" />} title="Rechercher un trajet" desc="Interurbain & urbain" />
        <QuickAction href="/agencies" icon={<MapPin className="size-4" />} title="Agences partenaires" desc="Buca · General Express · Touristique" />
        <QuickAction href="/dashboard#billing" icon={<Wallet className="size-4" />} title="Paiements & facturation" desc="Historique complet" />
      </section>

      <DashboardV2 initialData={data} token={token} />
    </div>
  )
}

function QuickAction({
  href,
  icon,
  title,
  desc,
}: {
  href: string
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-muted"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[11px] text-muted-foreground">{desc}</p>
        </div>
      </div>
      <ArrowRight className="size-4 opacity-30 transition-opacity group-hover:opacity-100" />
    </Link>
  )
}

function DashboardFallback() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export default function Page() {
  return (
    <DashboardShell title="Tableau de bord">
      <Suspense fallback={<DashboardFallback />}>
        <DashboardInner />
      </Suspense>
    </DashboardShell>
  )
}

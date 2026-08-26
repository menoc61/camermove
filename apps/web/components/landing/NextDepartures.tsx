import Link from "next/link"
import type { SearchResultItem } from "../../lib/api/search"

function timeFr(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" })
}
function dateFr(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Douala" })
}
function priceXaf(n: number): string {
  return `${new Intl.NumberFormat("fr-CM").format(n)} XAF`
}

export function NextDepartures({ trips }: { trips: SearchResultItem[] }) {
  return (
    <section id="departures" className="bg-bg">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-3xl font-bold tracking-tighter text-slate-900 md:text-4xl">
            Prochains départs Yaoundé → Douala
          </h2>
          <Link
            href="/results?origin=Yaound%C3%A9&destination=Douala&pax=1"
            className="text-sm font-semibold text-primary-dark underline-offset-4 hover:underline"
          >
            Voir tous les trajets →
          </Link>
        </div>

        {trips.length === 0 ? (
          <p className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Aucun départ disponible pour le moment — revenez bientôt.
          </p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((t) => (
              <Link
                key={t.id}
                href={`/trips/${t.id}`}
                className="group rounded-card border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-slate-900/5 active:translate-y-0 active:scale-[0.99]"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">
                    {timeFr(t.departureAt)}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary-dark">
                    {priceXaf(t.price)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{dateFr(t.departureAt)}</p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                  <span className="truncate text-slate-700">
                    {t.companyName}
                    {t.vehicleTypeInfo ? ` · ${t.vehicleTypeInfo}` : ""}
                  </span>
                  <span className="ml-2 shrink-0 font-medium text-primary-dark group-hover:underline">
                    Réserver
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

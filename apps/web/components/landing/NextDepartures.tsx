"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { priceXaf } from "@camermove/shared"
import type { SearchResultItem } from "../../lib/api/search"

function timeFr(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" })
}
function dateFr(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Douala" })
}

export function NextDepartures({ trips }: { trips: SearchResultItem[] }) {
  const shouldReduce = useReducedMotion()

  return (
    <section id="departures" className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tighter text-foreground md:text-4xl">
              Prochains départs Yaoundé → Douala
            </h2>
            <p className="mt-2 text-muted-foreground">
              Les premiers bus du jour, au meilleur prix.
            </p>
          </div>
          <Link
            href="/results?origin=Yaound%C3%A9&destination=Douala&pax=1"
            className="text-sm font-semibold text-primary-dark underline-offset-4 hover:underline"
          >
            Voir tous les trajets →
          </Link>
        </div>

        {trips.length === 0 ? (
          <p className="mt-8 rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            Aucun départ disponible pour le moment. Revenez bientôt.
          </p>
        ) : (
          <motion.ul
            initial={shouldReduce ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.4 }}
            className="mt-10 overflow-hidden rounded-2xl border border-border/60 bg-card"
          >
            {trips.map((t, i) => (
              <motion.li
                key={t.id}
                initial={shouldReduce ? false : { opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className={i > 0 ? "border-t border-border/60" : ""}
              >
                <Link
                  href={`/trips/${t.id}`}
                  className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-6 active:bg-muted/60"
                >
                  <div className="flex items-baseline gap-3 sm:w-28 sm:shrink-0">
                    <span className="font-['Plus_Jakarta_Sans'] text-xl font-bold tracking-tight text-foreground">
                      {timeFr(t.departureAt)}
                    </span>
                    <span className="text-xs text-muted-foreground sm:hidden">{dateFr(t.departureAt)}</span>
                  </div>
                  <div className="hidden text-xs text-muted-foreground sm:block sm:w-32 sm:shrink-0">
                    {dateFr(t.departureAt)}
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {t.companyName.charAt(0)}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {t.companyName}
                      {t.vehicleTypeInfo ? ` · ${t.vehicleTypeInfo}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:w-40 sm:justify-end">
                    <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand-dark">
                      {priceXaf(t.price)}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-dark transition-transform group-hover:translate-x-1">
                      Réserver →
                    </span>
                  </div>
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
    </section>
  )
}

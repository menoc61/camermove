"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { priceXaf } from "@camermove/shared"
import type { SearchResultItem } from "../../lib/api/search"

function timeFr(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Douala",
  })
}
function dateFr(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Africa/Douala",
  })
}

export function NextDepartures({ trips }: { trips: SearchResultItem[] }) {
  const shouldReduce = useReducedMotion()

  return (
    <section
      id="departures"
      aria-label="Prochains départs Yaoundé → Douala"
      className="border-t border-line bg-paper text-ink"
    >
      <div className="mx-auto max-w-[1560px] px-6 py-20 sm:px-8 md:px-12 md:py-28">
        <div className="mb-10 flex flex-col gap-6 border-b border-line pb-8 md:mb-12 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-ink-2">
              03 — Départs
            </p>
            <h2 className="mt-3 text-[clamp(2rem,3.6vw,3.2rem)] font-medium leading-[1.02] tracking-[-0.025em] text-balance">
              Prochains bus Yaoundé → Douala
            </h2>
            <p className="mt-3 max-w-[48ch] text-[15px] leading-[1.55] text-ink-1">
              Les premiers départs du jour, sélectionnés par nos partenaires
              transporteurs.
            </p>
          </div>
          <Link
            href="/results?origin=Yaound%C3%A9&destination=Douala&pax=1"
            className="group inline-flex items-center gap-3 self-start text-[11px] font-medium uppercase tracking-[0.22em] text-ink hover:text-ink-1"
          >
            <span className="block h-px w-10 bg-ink transition-all group-hover:w-16" aria-hidden />
            Voir tous les trajets
          </Link>
        </div>

        {trips.length === 0 ? (
          <p className="border border-dashed border-line bg-surface-1 p-10 text-center text-sm text-ink-2">
            Aucun départ disponible pour le moment. Revenez bientôt.
          </p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {trips.map((t, i) => (
              <motion.li
                key={t.id}
                initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
              >
                <Link
                  href={`/trips/${t.id}`}
                  className="group grid grid-cols-12 items-center gap-x-4 gap-y-3 px-1 py-6 transition-colors hover:bg-surface-2 sm:px-3"
                >
                  <div className="col-span-6 flex items-baseline gap-4 sm:col-span-2">
                    <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-2 num-tabular">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-body text-2xl font-medium tracking-[-0.02em] num-tabular">
                      {timeFr(t.departureAt)}
                    </span>
                  </div>
                  <div className="col-span-6 text-right text-[12px] uppercase tracking-[0.18em] text-ink-2 sm:col-span-2 sm:text-left">
                    {dateFr(t.departureAt)}
                  </div>
                  <div className="col-span-12 flex min-w-0 items-center gap-3 sm:col-span-4">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-ink text-[10px] font-medium text-ink">
                      {t.companyName.charAt(0)}
                    </span>
                    <span className="truncate text-sm text-ink-1">
                      {t.companyName}
                      {t.vehicleTypeInfo ? ` · ${t.vehicleTypeInfo}` : ""}
                    </span>
                  </div>
                  <div className="col-span-6 flex items-center gap-2 sm:col-span-2 sm:justify-start">
                    <span className="border border-wood-dark px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-wood-dark num-tabular">
                      {priceXaf(t.price)}
                    </span>
                  </div>
                  <div className="col-span-6 flex items-center justify-end gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-ink sm:col-span-2">
                    <span className="hidden sm:inline">Réserver</span>
                    <span
                      aria-hidden
                      className="block h-px w-8 bg-ink transition-all group-hover:w-14"
                    />
                  </div>
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

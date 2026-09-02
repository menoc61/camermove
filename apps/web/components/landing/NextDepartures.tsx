"use client"

import Link from "next/link"
import { motion, type Variants } from "motion/react"
import { priceXaf } from "@camermove/shared"
import { staggerContainer, staggerItem, spring } from "@/lib/animations"
import type { SearchResultItem } from "../../lib/api/search"

function timeFr(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" })
}
function dateFr(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Douala" })
}

const grid: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
}

const card: Variants = {
  hidden: { opacity: 0, transform: "translateY(12px)" },
  visible: { opacity: 1, transform: "translateY(0px)", transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] } },
}

const priceBadge: Variants = {
  hidden: { opacity: 0, transform: "scale(0.96)" },
  visible: { opacity: 1, transform: "scale(1)", transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] } },
}

export function NextDepartures({ trips }: { trips: SearchResultItem[] }) {
  return (
    <section id="departures" className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-3xl font-bold tracking-tighter text-foreground md:text-4xl">
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
          <p className="mt-8 rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            Aucun départ disponible pour le moment — revenez bientôt.
          </p>
        ) : (
          <motion.div
            variants={grid}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {trips.map((t) => (
              <motion.div key={t.id} variants={card}>
                <Link
                  href={`/trips/${t.id}`}
                  className="group block rounded-2xl bg-surface-1 p-5 shadow-sm transition-shadow hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-['Plus_Jakarta_Sans'] text-2xl font-bold tracking-tight text-foreground">
                      {timeFr(t.departureAt)}
                    </span>
                    <motion.span
                      variants={priceBadge}
                      className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand-dark"
                    >
                      {priceXaf(t.price)}
                    </motion.span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {dateFr(t.departureAt)}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {t.companyName.charAt(0)}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {t.companyName}
                        {t.vehicleTypeInfo ? ` · ${t.vehicleTypeInfo}` : ""}
                      </span>
                    </div>
                    <span className="ml-2 inline-flex shrink-0 items-center gap-1 font-medium text-primary-dark transition-transform group-hover:translate-x-1">
                      Réserver
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  )
}

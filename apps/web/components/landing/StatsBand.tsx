"use client"

import { motion, useReducedMotion } from "motion/react"

interface StatsBandProps {
  minPrice?: number
  hotelsCount?: number
  rentalsCount?: number
}

const formatXaf = (v: number) => new Intl.NumberFormat("fr-FR").format(v)

export function StatsBand({ minPrice, hotelsCount, rentalsCount }: StatsBandProps) {
  const shouldReduce = useReducedMotion()

  const stats = [
    { label: "Départ quotidien", value: "Yaoundé ⇄ Douala" },
    { label: "Prix dès", value: minPrice != null ? `${formatXaf(minPrice)} XAF` : "—" },
    { label: "Services", value: "6" },
    { label: "Hébergements", value: hotelsCount != null ? String(hotelsCount) : "—" },
    { label: "Véhicules", value: rentalsCount != null ? String(rentalsCount) : "—" },
  ]

  return (
    <section className="border-y border-border/60 bg-surface-0" aria-label="CamerMove en chiffres">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-6 px-4 py-8 sm:px-6 md:grid-cols-5">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={shouldReduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="border-l-2 border-[hsl(var(--brand)/0.35)] pl-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-1 text-lg font-bold tracking-tight text-foreground">{s.value}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

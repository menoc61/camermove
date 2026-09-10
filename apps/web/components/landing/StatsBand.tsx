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
    { label: "Liaison quotidienne", value: "Yaoundé ⇄ Douala" },
    {
      label: "Prix dès",
      value: minPrice != null ? `${formatXaf(minPrice)} XAF` : "—",
    },
    { label: "Services", value: "Six" },
    {
      label: "Hébergements",
      value: hotelsCount != null ? String(hotelsCount) : "—",
    },
    {
      label: "Véhicules",
      value: rentalsCount != null ? String(rentalsCount) : "—",
    },
  ]

  return (
    <section
      aria-label="CamerMove en chiffres"
      className="border-y border-line bg-paper text-ink"
    >
      <div className="mx-auto max-w-[1560px] px-6 pt-12 sm:px-8 md:px-12 md:pt-16">
        <p className="text-[11px] uppercase tracking-[0.22em] text-ink-2">
          01 — En chiffres
        </p>
      </div>
      <div className="mx-auto mt-6 grid max-w-[1560px] grid-cols-2 gap-px border-t border-line bg-line md:grid-cols-5">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={shouldReduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-2 bg-paper px-5 py-7 sm:px-7 sm:py-9"
          >
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-2 num-tabular">
              {String(i + 1).padStart(2, "0")} · {s.label}
            </span>
            <span className="text-[clamp(1.4rem,2.2vw,2rem)] font-medium tracking-[-0.02em] text-ink">
              {s.value}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

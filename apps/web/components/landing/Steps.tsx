"use client"

import { motion, useReducedMotion } from "motion/react"

const steps = [
  {
    n: "01",
    title: "Recherchez",
    body: "Comparez les départs par horaire, prix et opérateur. Filtrage en direct, sans rechargement.",
  },
  {
    n: "02",
    title: "Réservez et payez",
    body: "Sélectionnez vos sièges, payez par Mobile Money, carte ou virement. Confirmation instantanée.",
  },
  {
    n: "03",
    title: "Voyagez léger",
    body: "E-billet QR dans votre poche. Présentation au contrôle, modification ou annulation depuis l’app.",
  },
]

export function Steps() {
  const shouldReduce = useReducedMotion()

  return (
    <section
      id="etapes"
      aria-label="Trois étapes pour réserver"
      className="border-t border-line bg-paper text-ink"
    >
      <div className="mx-auto max-w-[1560px] px-6 py-20 sm:px-8 md:px-12 md:py-28">
        <div className="grid grid-cols-12 gap-x-6 gap-y-12">
          <div className="col-span-12 md:col-span-4">
            <motion.p
              initial={shouldReduce ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-[11px] uppercase tracking-[0.22em] text-ink-2"
            >
              02 — Processus
            </motion.p>
            <motion.h2
              initial={shouldReduce ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-4 text-[clamp(2rem,3.6vw,3.2rem)] font-medium leading-[1.02] tracking-[-0.025em] text-balance"
            >
              Trois étapes, un seul compte, zéro friction.
            </motion.h2>
          </div>

          <ol className="col-span-12 grid grid-cols-1 gap-px bg-line md:col-span-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <motion.li
                key={s.n}
                initial={shouldReduce ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-5 bg-paper p-6 sm:p-7"
              >
                <div className="flex items-center justify-between">
                  <span className="font-body text-3xl font-medium leading-none tracking-[-0.04em] text-ink num-tabular">
                    {s.n}
                  </span>
                  <span className="h-px w-12 bg-line" aria-hidden />
                </div>
                <h3 className="text-xl font-medium tracking-[-0.015em] text-ink">
                  {s.title}
                </h3>
                <p className="max-w-[36ch] text-[15px] leading-[1.55] text-ink-1">
                  {s.body}
                </p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

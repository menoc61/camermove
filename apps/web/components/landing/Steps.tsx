"use client"

import { motion, useReducedMotion } from "motion/react"
import { Search, CreditCard, QrCode } from "lucide-react"

const steps = [
  {
    title: "Recherchez",
    body: "Choisissez votre date et comparez les départs disponibles en quelques secondes.",
    Icon: Search,
  },
  {
    title: "Réservez et payez",
    body: "Sélectionnez vos sièges, payez par Mobile Money ou carte, en toute sécurité.",
    Icon: CreditCard,
  },
  {
    title: "Voyagez avec votre e-billet",
    body: "Recevez un billet QR sur votre téléphone, présentez-le au contrôle, rien à imprimer.",
    Icon: QrCode,
  },
]

export function Steps() {
  const shouldReduce = useReducedMotion()

  return (
    <section id="etapes" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-[hsl(var(--brand)/0.02)] to-background" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <motion.div
          initial={shouldReduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl"
        >
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Réserver en trois étapes
          </h2>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            De la recherche au billet QR, votre réservation est fluide et sécurisée.
          </p>
        </motion.div>

        <div className="relative mt-14">
          {/* Connector line (desktop only) */}
          <div
            aria-hidden
            className="absolute left-[12%] right-[12%] top-8 hidden border-t-2 border-dashed border-[hsl(var(--brand)/0.25)] md:block"
          />
          <ol className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((s, i) => (
              <motion.li
                key={s.title}
                initial={shouldReduce ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="relative text-center md:text-left"
              >
                <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-card shadow-sm md:mx-0">
                  <s.Icon className="size-7 text-[hsl(var(--brand))]" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-muted-foreground md:mx-0">
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

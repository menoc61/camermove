"use client"

import { motion, useReducedMotion } from "motion/react"
import { Search, CreditCard, QrCode, ArrowRight } from "lucide-react"

const steps = [
  {
    title: "Recherchez",
    body: "Choisissez votre date et comparez les départs disponibles en quelques secondes.",
    Icon: Search,
    color: "bg-[hsl(var(--brand)/0.1)] text-[hsl(var(--brand))]",
  },
  {
    title: "Réservez et payez",
    body: "Sélectionnez vos sièges, payez par Mobile Money ou carte, en toute sécurité.",
    Icon: CreditCard,
    color: "bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))]",
  },
  {
    title: "Voyagez avec votre e-billet",
    body: "Recevez un billet QR sur votre téléphone : présentez-le au contrôle, rien à imprimer.",
    Icon: QrCode,
    color: "bg-[hsl(var(--brand-light)/0.15)] text-[hsl(var(--brand-dark))]",
  },
]

export function Steps() {
  const shouldReduce = useReducedMotion()

  return (
    <section id="etapes" className="relative overflow-hidden">
      {/* Subtle warm background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-[hsl(var(--brand)/0.02)] to-background" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <motion.div
          initial={shouldReduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl"
        >
          <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-widest text-[hsl(var(--brand))]">
            Simple et rapide
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Réserver en trois étapes
          </h2>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            De la recherche au billet QR, votre réservation est fluide et sécurisée.
          </p>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={shouldReduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="hover-lift group relative rounded-2xl border border-border/50 bg-card p-6 shadow-sm"
            >
              {/* Step number */}
              <span className="absolute -top-3 left-6 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--brand))] text-xs font-bold text-white">
                {i + 1}
              </span>

              <div className={`mb-4 inline-flex rounded-xl p-3 ${s.color}`}>
                <s.Icon className="size-5" />
              </div>

              <h3 className="text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>

              {/* Connector arrow (hidden on last item) */}
              {i < steps.length - 1 && (
                <div className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 md:block">
                  <ArrowRight className="size-5 text-[hsl(var(--brand)/0.3)]" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

"use client"

import { motion, useReducedMotion } from "motion/react"
import { Search, CreditCard, QrCode } from "lucide-react"

const steps = [
  {
    num: "01",
    title: "Recherchez",
    body: "Choisissez votre date et comparez les départs disponibles en quelques secondes.",
    Icon: Search,
  },
  {
    num: "02",
    title: "Réservez et payez",
    body: "Sélectionnez vos sièges, payez par Mobile Money ou carte, en toute sécurité.",
    Icon: CreditCard,
  },
  {
    num: "03",
    title: "Voyagez avec votre e-billet",
    body: "Recevez un billet QR sur votre téléphone : présentez-le au contrôle, rien à imprimer.",
    Icon: QrCode,
  },
]

export function Steps() {
  const shouldReduce = useReducedMotion()

  // Gate: occasional (section enter) → standard animation. Purpose: state indication + preventing jarring change.
  // Tool: Motion (exit + stagger + reducedMotion). Props: transform/opacity only. Ease: ease-out. Duration: 220ms, stagger 60ms.
  return (
    <section id="etapes" className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <motion.h2
          initial={shouldReduce ? false : { opacity: 0, transform: "translateY(12px)" }}
          whileInView={{ opacity: 1, transform: "translateY(0px)" }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
          className="text-3xl font-bold tracking-tighter text-foreground md:text-4xl"
        >
          Comment ça marche
        </motion.h2>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px", amount: 0.2 }}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.06, delayChildren: 0.08 },
            },
          }}
          className="mt-10 grid grid-cols-1 gap-8 border-t border-border pt-10 md:grid-cols-3"
        >
          {steps.map((s) => (
            <motion.div
              key={s.num}
              variants={{
                hidden: shouldReduce
                  ? { opacity: 0 }
                  : { opacity: 0, transform: "translateY(16px) scale(0.97)" },
                visible: {
                  opacity: 1,
                  transform: "translateY(0px) scale(1)",
                  transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
                },
              }}
              whileHover={
                shouldReduce
                  ? undefined
                  : { transform: "translateY(-4px)", transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }
              }
              // gate hover to pointer:fine via CSS class
              className="hover-lift group relative overflow-hidden rounded-2xl bg-surface-1 p-6 shadow-sm will-change-transform"
            >
              <span className="pointer-events-none absolute -top-4 -right-2 font-[family-name:var(--font-heading)] text-6xl font-extrabold text-brand/20">
                {s.num}
              </span>
              <div className="mb-4 inline-flex rounded-xl bg-brand/10 p-3 transition-colors duration-[150ms] ease-[var(--ease-out)] group-hover:bg-brand/15">
                <s.Icon className="size-6 text-brand" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

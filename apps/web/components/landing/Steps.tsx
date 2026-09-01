"use client"

import { motion } from "motion/react"
import { Search, CreditCard, QrCode } from "lucide-react"
import { staggerContainer, staggerItem } from "@/lib/animations"

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
  return (
    <section id="etapes" className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <h2 className="text-3xl font-bold tracking-tighter text-foreground md:text-4xl">
          Comment ça marche
        </h2>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mt-10 grid grid-cols-1 gap-8 border-t border-border pt-10 md:grid-cols-3"
        >
          {steps.map((s) => (
            <motion.div
              key={s.num}
              variants={staggerItem}
              className="relative overflow-hidden rounded-2xl bg-surface-1 p-6 shadow-sm"
            >
              <span className="pointer-events-none absolute -top-4 -right-2 font-[family-name:var(--font-heading)] text-6xl font-extrabold text-brand/20">
                {s.num}
              </span>
              <div className="mb-4 inline-flex rounded-xl bg-brand/10 p-3">
                <s.Icon className="size-6 text-brand" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                {s.title}
              </h3>
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

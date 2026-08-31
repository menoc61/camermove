"use client"

import { MotionSection } from "./MotionSection"

const steps = [
  {
    num: "01",
    title: "Recherchez",
    body: "Choisissez votre date et comparez les départs disponibles en quelques secondes.",
  },
  {
    num: "02",
    title: "Réservez et payez",
    body: "Sélectionnez vos sièges, payez par Mobile Money ou carte, en toute sécurité.",
  },
  {
    num: "03",
    title: "Voyagez avec votre e-billet",
    body: "Recevez un billet QR sur votre téléphone : présentez-le au contrôle, rien à imprimer.",
  },
]

export function Steps() {
  return (
    <section id="etapes" className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <h2 className="text-3xl font-bold tracking-tighter text-foreground md:text-4xl">
          Comment ça marche
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-8 border-t border-border pt-10 md:grid-cols-3">
          {steps.map((s, i) => (
            <MotionSection key={s.num} delay={i * 0.15}>
              <div>
                <div className="font-mono text-5xl font-bold text-primary">
                  {s.num}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {s.title}
                </h3>
                <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </MotionSection>
          ))}
        </div>
      </div>
    </section>
  )
}

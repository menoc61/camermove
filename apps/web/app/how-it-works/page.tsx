import type { Metadata } from "next"
import { SiteNav } from "@/components/landing/SiteNav"
import { SiteFooter } from "@/components/landing/SiteFooter"

export const metadata: Metadata = {
  title: "Comment ça marche — CamerMove",
  description: "Recherchez, réservez et voyagez en 4 étapes simples avec CamerMove.",
}

const steps = [
  { n: "01", title: "Recherchez", desc: "Indiquez votre ville de départ, destination, date et nombre de passagers. Obtenez les offres Yaoundé ↔ Douala en temps réel." },
  { n: "02", title: "Comparez", desc: "Filtrez par prix, horaire, transporteur, type de véhicule et disponibilité. Triez par prix ou heure de départ." },
  { n: "03", title: "Réservez & payez", desc: "Bloquez vos places de façon atomique (aucun surbooking), renseignez les passagers et payez via Mobile Money (MTN/Orange) ou carte." },
  { n: "04", title: "Voyagez", desc: "Recevez votre e-ticket avec QR code. Présentez-le à l'embarquement — suivi et rappel 24h avant départ." },
]

export default function HowItWorksPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-4xl px-4 py-24 sm:px-6">
        <h1 className="text-4xl font-bold tracking-tighter">Comment ça marche</h1>
        <p className="mt-3 text-muted-foreground">De la recherche à l&apos;embarquement, 4 étapes — simple, rapide, sans double-réservation.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border bg-card p-6">
              <div className="text-sm font-mono text-primary">{s.n}</div>
              <h2 className="mt-2 text-lg font-semibold">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 rounded-2xl border bg-muted/30 p-6">
          <h3 className="font-semibold">Garanties CamerMove</h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Sièges bloqués 15 min (configurable) — aucune double-réservation grâce aux transactions ACID + verrous.</li>
            <li>Paiement idempotent (Idempotency-Key) — rejouez sans double débit.</li>
            <li>Tickets vérifiables par QR / code — contrôle instantané.</li>
            <li>Support Mobile Money priorité Cameroun (NotchPay / CinetPay).</li>
          </ul>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}

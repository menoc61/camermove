import type { Metadata } from "next"
import Link from "next/link"
import { SiteNav } from "@/components/landing/SiteNav"
import { SiteFooter } from "@/components/landing/SiteFooter"

export const metadata: Metadata = {
  title: "Devenir partenaire — CamerMove",
  description: "Rejoignez CamerMove comme transporteur partenaire.",
}

export default function BecomePartnerPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-4xl px-4 py-24 sm:px-6">
        <h1 className="text-4xl font-bold tracking-tighter">Devenir partenaire</h1>
        <p className="mt-3 text-muted-foreground">Développez votre remplissage — gérez votre flotte, vos itinéraires et vos revenus depuis votre espace transporteur.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="font-semibold">Visibilité</h3>
            <p className="mt-2 text-sm text-muted-foreground">Vos offres Yaoundé ↔ Douala exposées sur une recherche puissante (filtres, tri, pagination) et cartographiées.</p>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="font-semibold">Autonomie</h3>
            <p className="mt-2 text-sm text-muted-foreground">Gérez profil, véhicules, routes, horaires, prix et capacité — uploads présignés MinIO pour vos documents.</p>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="font-semibold">Revenus</h3>
            <p className="mt-2 text-sm text-muted-foreground">Suivez réservations, paiements et commissions (globale + surcharge par transporteur).</p>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/transporter/apply" className="inline-flex h-11 items-center rounded-xl bg-primary px-8 font-semibold text-primary-foreground">Candidater maintenant</Link>
          <Link href="/contact" className="inline-flex h-11 items-center rounded-xl border px-8 font-medium">Nous contacter</Link>
        </div>
        <div className="mt-10 rounded-2xl border bg-muted/20 p-6 text-sm text-muted-foreground">
          <p><strong className="text-foreground">Processus :</strong> candidature (société, flotte, axes desservis, pièces) → examen admin → approbation → accès espace transporteur.</p>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}

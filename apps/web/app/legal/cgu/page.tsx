import type { Metadata } from "next"
import { SiteNav } from "@/components/landing/SiteNav"
import { SiteFooter } from "@/components/landing/SiteFooter"

export const metadata: Metadata = {
  title: "Conditions générales — CamerMove",
  description: "CGU de CamerMove.",
}

export default function CguPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-24 sm:px-6 prose prose-sm dark:prose-invert">
        <h1>Conditions générales d&apos;utilisation</h1>
        <p className="lead">Dernière mise à jour : 2026-09-02</p>
        <h2>1. Objet</h2>
        <p>CamerMove est une plateforme d&apos;intermédiation entre voyageurs et transporteurs interurbains au Cameroun (axe Yaoundé ↔ Douala au lancement).</p>
        <h2>2. Réservation &amp; paiement</h2>
        <p>La réservation bloque les sièges de façon atomique. Le paiement est opéré via prestataires agréés (NotchPay, CinetPay) — CamerMove ne stocke aucune donnée brute de carte.</p>
        <h2>3. Billets</h2>
        <p>Le billet électronique avec QR code / code de vérification est la preuve de voyage. Il est vérifiable via /tickets/lookup.</p>
        <h2>4. Annulation</h2>
        <p>Selon la politique affichée sur chaque trajet (défaut : annulation possible jusqu&apos;à 1h avant départ, paramétrable par l&apos;admin).</p>
        <h2>5. Commission</h2>
        <p>Commission globale configurable sans redéploiement, avec surcharge possible par transporteur — affichée dans le récapitulatif.</p>
        <h2>6. Contact</h2>
        <p>contact@camermove.cm</p>
      </main>
      <SiteFooter />
    </>
  )
}

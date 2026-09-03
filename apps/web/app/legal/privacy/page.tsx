import type { Metadata } from "next"
import { SiteNav } from "@/components/landing/SiteNav"
import { SiteFooter } from "@/components/landing/SiteFooter"

export const metadata: Metadata = {
  title: "Confidentialité — CamerMove",
  description: "Politique de confidentialité CamerMove.",
}

export default function PrivacyPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-24 sm:px-6 prose prose-sm dark:prose-invert">
        <h1>Politique de confidentialité</h1>
        <p className="lead">Dernière mise à jour : 2026-09-02</p>
        <h2>Données collectées</h2>
        <p>Email, nom, téléphone, métadonnées de requête (IP, OS, navigateur, device — via metadataPlugin), données de réservation.</p>
        <h2>Finalités</h2>
        <p>Exécution de la réservation, paiement, émission du billet, notifications (email/WhatsApp/push), audit et prévention de fraude.</p>
        <h2>Conservation</h2>
        <p>Journaux d&apos;audit et notifications conservés selon obligations légales. Données de paiement : référence prestataire seule.</p>
        <h2>Droits</h2>
        <p>Contactez contact@camermove.cm pour accès, rectification, suppression.</p>
      </main>
      <SiteFooter />
    </>
  )
}

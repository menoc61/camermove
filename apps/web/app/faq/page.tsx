import type { Metadata } from "next"
import { SiteNav } from "@/components/landing/SiteNav"
import { SiteFooter } from "@/components/landing/SiteFooter"

export const metadata: Metadata = {
  title: "FAQ — CamerMove",
  description: "Questions fréquentes sur CamerMove : réservation, paiement, billets, annulation.",
}

const faqs = [
  { q: "Quels trajets sont disponibles ?", a: "Le lancement couvre Yaoundé ↔ Douala. D'autres axes seront ajoutés sans redéploiement, par configuration." },
  { q: "Comment payer ?", a: "Mobile Money MTN/Orange via NotchPay/CinetPay en priorité, puis carte bancaire. Aucune donnée carte n'est stockée côté CamerMove." },
  { q: "Mon siège est-il garanti ?", a: "Oui : la création de réservation verrouille les places en transaction atomique (row lock + Redis TTL). Impossible de surbooker le dernier siège." },
  { q: "Combien de temps est bloquée ma réservation ?", a: "15 minutes par défaut (réglable côté admin) pour finaliser le paiement. Après expiration, les places sont libérées automatiquement." },
  { q: "Comment récupérer mon billet ?", a: "Après paiement confirmé, votre e-ticket avec QR code est accessible dans Mon tableau de bord → Mes billets et via /tickets/lookup avec la référence." },
  { q: "Puis-je annuler ?", a: "Selon la politique du trajet (visible sur la fiche). Si autorisée, l'annulation rembourse selon les paliers et libère les sièges." },
  { q: "Que faire si mon paiement reste en attente ?", a: "La réconciliation horaire récupère automatiquement les paiements bloqués. Vous pouvez aussi vérifier le statut sur votre billet — il se met à jour par polling." },
  { q: "Comment devenir transporteur partenaire ?", a: "Page Devenir partenaire → formulaire + pièces (via upload présigné MinIO) → examen admin → approbation." },
]

export default function FaqPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <h1 className="text-4xl font-bold tracking-tighter">FAQ</h1>
        <p className="mt-2 text-muted-foreground">Tout ce que vous devez savoir.</p>
        <div className="mt-8 divide-y rounded-2xl border">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5 open:bg-muted/20">
              <summary className="cursor-pointer list-none font-medium flex justify-between gap-4">
                <span>{f.q}</span>
                <span className="text-muted-foreground group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}

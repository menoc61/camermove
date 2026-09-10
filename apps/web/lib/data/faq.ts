export interface FaqItem {
  q: string
  a: string
}

export const FAQS: FaqItem[] = [
  {
    q: "Quels trajets sont disponibles ?",
    a: "Le lancement couvre Yaoundé ↔ Douala. D'autres axes seront ajoutés sans redéploiement, par configuration côté admin.",
  },
  {
    q: "Comment payer ?",
    a: "Mobile Money MTN / Orange via NotchPay / CinetPay en priorité, puis carte bancaire. Aucune donnée carte n'est stockée côté CamerMove.",
  },
  {
    q: "Mon siège est-il garanti ?",
    a: "Oui : la création de réservation verrouille les places en transaction atomique (row lock + TTL Redis). Impossible de surbooker le dernier siège.",
  },
  {
    q: "Combien de temps est bloquée ma réservation ?",
    a: "15 minutes par défaut (réglable côté admin) pour finaliser le paiement. Après expiration, les places sont libérées automatiquement.",
  },
  {
    q: "Comment récupérer mon billet ?",
    a: "Après paiement confirmé, votre e-ticket avec QR code est accessible dans Mon tableau de bord → Mes billets et via /tickets/lookup avec la référence.",
  },
  {
    q: "Puis-je annuler ?",
    a: "Selon la politique du trajet (visible sur la fiche). Si autorisée, l'annulation rembourse selon les paliers et libère les sièges.",
  },
  {
    q: "Que faire si mon paiement reste en attente ?",
    a: "La réconciliation horaire récupère automatiquement les paiements bloqués. Vous pouvez aussi vérifier le statut sur votre billet — il se met à jour par polling.",
  },
  {
    q: "Comment devenir transporteur partenaire ?",
    a: "Page Devenir partenaire → formulaire + pièces (via upload présigné MinIO) → examen admin → approbation.",
  },
]

export const FAQ_TEASER: FaqItem[] = FAQS.slice(0, 4)

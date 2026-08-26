"use client"
/**
 * Carte de statut affichée après l'envoi réussi de la demande partenaire.
 * Les détails viennent de GET /partner-applications/me ; en cas d'indispo,
 * retombe sur les valeurs saisies dans le formulaire.
 */
import { Check } from "lucide-react"
import type { MyApplication } from "../../lib/api/partner"
import { STATUS_LABELS } from "./form-core"

export function StatusCard({
  details,
  fallbackCompanyName,
  routesServed,
}: {
  details: MyApplication | null
  fallbackCompanyName: string
  routesServed: string
}) {
  const routes = routesServed.split(",").map((r) => r.trim()).filter(Boolean)
  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <Check className="h-5 w-5 text-green-600" />
        <p className="font-medium">Votre demande a bien été envoyée</p>
      </div>
      <div className="space-y-1 text-sm text-slate-600">
        <p>Statut : <span className="font-semibold text-[#0e9f8f]">{STATUS_LABELS[details?.status ?? "received"] ?? details?.status ?? "Reçue"}</span></p>
        <p>Entreprise : {details?.companyName ?? fallbackCompanyName}</p>
        {details?.createdAt && <p>Déposée le {new Date(details.createdAt).toLocaleDateString("fr-FR")}</p>}
        {routes.length > 0 && <p>Routes desservies : {routes.join(", ")}</p>}
        {details?.documents && <p>{details.documents.length} document(s) transmis.</p>}
      </div>
    </div>
  )
}

/**
 * Shared bits for the transporter apply wizard: document constraints, form
 * types and client-side validation mirroring the API Zod rules
 * (apps/api/src/partner-applications/schema.ts).
 */
import type { ReactNode } from "react"
import type { DocumentType } from "../../lib/api/partner"

export const ACCEPT = ".pdf,.jpg,.jpeg,.png"
export const MIME_OK = ["application/pdf", "image/jpeg", "image/png"]
export const MAX_DOC_BYTES = 10 * 1024 * 1024

export type UploadState = "idle" | "uploading" | "done" | "error"

export interface DocInfo {
  status: UploadState
  name?: string
  objectKey?: string
  mimetype?: string
  size?: number
}

export interface FormState {
  companyName: string; contactName: string; phone: string; city: string
  transportType: string; vehicleCount: string; routesServed: string; message: string
}

export const EMPTY_FORM: FormState = {
  companyName: "", contactName: "", phone: "", city: "",
  transportType: "", vehicleCount: "", routesServed: "", message: "",
}

export const EMPTY_DOCS: Record<DocumentType, DocInfo> = {
  business_registration: { status: "idle" }, insurance: { status: "idle" },
  transport_license: { status: "idle" }, id_document: { status: "idle" },
}

export const DOC_TYPES: Array<{ type: DocumentType; label: string; required?: boolean }> = [
  { type: "business_registration", label: "Registre de commerce", required: true },
  { type: "insurance", label: "Assurance du véhicule" },
  { type: "transport_license", label: "Licence de transport" },
  { type: "id_document", label: "Pièce d'identité" },
]

export const STATUS_LABELS: Record<string, string> = {
  received: "Reçue", pending: "En attente", under_review: "En cours d'examen",
  approved: "Approuvée", rejected: "Rejetée",
}

/** Miroir des règles Zod : longueurs, entier 0-500, ≤50 routes de ≤120, message ≤2000. */
export function validateCompany(f: FormState): Partial<Record<keyof FormState, string>> {
  const e: Partial<Record<keyof FormState, string>> = {}
  if (f.companyName.trim().length < 2 || f.companyName.trim().length > 120)
    e.companyName = "Nom de l'entreprise requis (2 à 120 caractères)"
  if (f.contactName.trim().length < 2 || f.contactName.trim().length > 120)
    e.contactName = "Nom du contact requis (2 à 120 caractères)"
  if (f.phone.trim().length < 6 || f.phone.trim().length > 30)
    e.phone = "Téléphone requis (6 à 30 caractères)"
  if (f.city.trim() && (f.city.trim().length < 2 || f.city.trim().length > 80))
    e.city = "Ville invalide (2 à 80 caractères)"
  if (f.transportType.trim() && (f.transportType.trim().length < 2 || f.transportType.trim().length > 80))
    e.transportType = "Type de transport invalide (2 à 80 caractères)"
  if (f.vehicleCount.trim() && !/^\d+$/.test(f.vehicleCount.trim()))
    e.vehicleCount = "Nombre de véhicules invalide (entier entre 0 et 500)"
  else if (f.vehicleCount.trim() && Number(f.vehicleCount) > 500)
    e.vehicleCount = "Maximum 500 véhicules"
  const routes = f.routesServed.split(",").map((r) => r.trim()).filter(Boolean)
  if (routes.length > 50) e.routesServed = "Maximum 50 routes"
  else if (routes.some((r) => r.length > 120)) e.routesServed = "Chaque route : 120 caractères maximum"
  if (f.message.trim().length > 2000) e.message = "Message trop long (2000 caractères maximum)"
  return e
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      {children}
      {error && <span className="mt-1 block text-xs font-normal text-red-600">{error}</span>}
    </label>
  )
}

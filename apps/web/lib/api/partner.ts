import { request, resourceClient } from "./resource"

const partner = resourceClient<never>("/api/v1/partner-applications")

export type DocumentType = "business_registration" | "insurance" | "transport_license" | "id_document"

export interface PresignResponse {
  objectKey: string
  uploadUrl: string
}

export interface ApplicationPayload {
  companyName: string
  contactName: string
  phone: string
  city?: string
  transportType?: string
  vehicleCount?: number
  routesServed: string[]
  message?: string
  documents: Array<{ type: DocumentType; objectKey: string; mimetype: string; size: number }>
}

export function presignDocument(token: string, body: { type: DocumentType; mimetype: string; size: number }) {
  return partner.create<PresignResponse>("/presign", body, { token })
}

export async function uploadToPresigned(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, { method: "PUT", body: file })
  if (!res.ok) throw new Error(`Échec de l'envoi du fichier (${res.status})`)
}

export function submitApplication(token: string, payload: ApplicationPayload) {
  return partner.create<{ id: string; status: string }>("", payload, { token })
}

export interface MyApplication {
  id: string
  status: string
  createdAt: string
  companyName: string
  documents: Array<{ type: string; size: number; mimetype: string; createdAt: string }>
}

export function getMyApplication(token: string) {
  return partner.get<MyApplication | null>("/me", { token })
}

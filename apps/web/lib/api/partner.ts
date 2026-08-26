/**
 * API helpers for partner applications (TRANS-01). Mirrors bookings.ts:
 * Bearer token via apiFetch; uploads go browser→MinIO through presigned
 * PUT URLs so no document bytes ever transit the API.
 */
import { apiFetch } from "./client"

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
  return apiFetch<PresignResponse>("/api/v1/partner-applications/presign", {
    method: "POST",
    body: JSON.stringify(body),
    token,
  })
}

export async function uploadToPresigned(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, { method: "PUT", body: file })
  if (!res.ok) throw new Error(`Échec de l'envoi du fichier (${res.status})`)
}

export function submitApplication(token: string, payload: ApplicationPayload) {
  return apiFetch<{ id: string; status: string }>("/api/v1/partner-applications", {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  })
}

export interface MyApplication {
  id: string
  status: string
  createdAt: string
  companyName: string
  documents: Array<{ type: string; size: number; mimetype: string; createdAt: string }>
}

export function getMyApplication(token: string) {
  return apiFetch<MyApplication | null>("/api/v1/partner-applications/me", { method: "GET", token })
}

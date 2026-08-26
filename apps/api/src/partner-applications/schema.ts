import { z } from "zod"

export const DOC_TYPES = [
  "business_registration",
  "insurance",
  "transport_license",
  "id_document",
] as const

export const DocumentType = z.enum(DOC_TYPES)
export const AllowedMimetype = z.enum(["application/pdf", "image/jpeg", "image/png"])
const MAX_DOC_BYTES = 10 * 1024 * 1024

export const PresignInput = z.object({
  type: DocumentType,
  mimetype: AllowedMimetype,
  size: z.number().int().min(1).max(MAX_DOC_BYTES),
})

export const DocumentRef = z.object({
  type: DocumentType,
  objectKey: z.string().min(3).max(256),
  mimetype: AllowedMimetype,
  size: z.number().int().min(1).max(MAX_DOC_BYTES),
})

export const ApplicationInput = z.object({
  companyName: z.string().min(2).max(120),
  contactName: z.string().min(2).max(120),
  phone: z.string().min(6).max(30),
  city: z.string().min(2).max(80).optional(),
  transportType: z.string().min(2).max(80).optional(),
  vehicleCount: z.number().int().min(0).max(500).optional(),
  routesServed: z.array(z.string().min(1).max(120)).max(50),
  message: z.string().max(2000).optional(),
  documents: z.array(DocumentRef).min(1).max(10),
})

export type PresignInputT = z.infer<typeof PresignInput>
export type ApplicationInputT = z.infer<typeof ApplicationInput>

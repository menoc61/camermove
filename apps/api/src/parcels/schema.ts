import { z } from "zod"

export const CreateParcelSchema = z.object({
  senderName: z.string().min(2).max(100),
  senderPhone: z.string().min(6).max(20),
  recipientName: z.string().min(2).max(100),
  recipientPhone: z.string().min(6).max(20),
  senderCity: z.string().min(2).max(100),
  recipientCity: z.string().min(2).max(100),
  recipientAddress: z.string().max(200).optional(),
  parcelType: z.string().min(1).max(50),
  weightKg: z.coerce.number().min(0.1).max(1000).optional(),
  dimensionsCm: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  declaredValue: z.coerce.number().int().min(0).optional(),
  operatorId: z.string().cuid().optional(),
})

export const ParcelStatusUpdateSchema = z.object({
  status: z.enum(["registered", "picked_up", "in_transit", "arrived", "available_for_pickup", "delivered", "returned"]),
  location: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
})

export const ParcelSearchQuery = z.object({
  q: z.string().optional(),
  status: z.enum(["registered", "picked_up", "in_transit", "arrived", "available_for_pickup", "delivered", "returned"]).optional(),
  recipientCity: z.string().optional(),
  senderCity: z.string().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  orderBy: z.string().optional(),
  groupBy: z.string().optional(),
})

export const ParcelIdParams = z.object({ id: z.string().cuid() })
export const ParcelTrackParams = z.object({ trackingNumber: z.string().min(1) })

export type CreateParcelInput = z.infer<typeof CreateParcelSchema>
export type ParcelStatusUpdateInput = z.infer<typeof ParcelStatusUpdateSchema>
export type ParcelSearchQueryInput = z.infer<typeof ParcelSearchQuery>

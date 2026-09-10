import { z } from "zod"

export const CreatePolicyBody = z.object({
  destination: z.string().min(2),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  travelersCount: z.coerce.number().int().min(1).max(20),
  coverageType: z.enum(["basic", "standard", "premium", "family"]),
})

export const InsuranceSearchQuery = z.object({
  q: z.string().optional(),
  coverageType: z.enum(["basic", "standard", "premium", "family"]).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  orderBy: z.string().optional(),
  groupBy: z.string().optional(),
})

export const PolicyParams = z.object({ id: z.string().cuid() })

export const PolicyPayBody = z.object({
  provider: z.enum(["notchpay", "cinetpay"]).default("notchpay"),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  method: z.enum(["mobile_money", "card", "bank_transfer"]).optional(),
})

export type CreatePolicyBody = z.infer<typeof CreatePolicyBody>
export type InsuranceSearchQuery = z.infer<typeof InsuranceSearchQuery>
export type PolicyParams = z.infer<typeof PolicyParams>
export type PolicyPayBody = z.infer<typeof PolicyPayBody>

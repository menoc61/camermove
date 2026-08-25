import { z } from "zod"

export const CreatePaymentBody = z.object({
  bookingId: z.string().cuid(),
  provider: z.enum(["notchpay", "cinetpay"]),
  method: z.enum(["mobile_money", "card", "bank_transfer"]).optional(),
  phone: z.string().min(6).max(20).optional(),
  email: z.string().email().optional(),
})

export const PaymentParams = z.object({ id: z.string().cuid() })

export const PaymentListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "processing", "success", "failed", "expired", "refunded"]).optional(),
  provider: z.enum(["notchpay", "cinetpay"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  q: z.string().optional(),
  orderBy: z.string().optional(),
})

export const PaymentExportQuery = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  format: z.enum(["json", "csv"]).default("json"),
  q: z.string().optional(),
  groupBy: z.string().optional(),
  orderBy: z.string().optional(),
})

export type CreatePaymentBody = z.infer<typeof CreatePaymentBody>
export type PaymentParams = z.infer<typeof PaymentParams>
export type PaymentListQuery = z.infer<typeof PaymentListQuery>
export type PaymentExportQuery = z.infer<typeof PaymentExportQuery>

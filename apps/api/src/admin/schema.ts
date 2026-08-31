import { z } from "zod"

export const AdminRoleFilter = z.enum(["traveler", "transporter_staff", "admin", "super_admin"])
export const AdminStatusFilter = z.enum(["active", "inactive", "pending"]).optional()
export const TransporterStatusFilter = z.enum(["pending", "reviewing", "approved", "rejected"]).optional()
export const BookingStatusFilter = z.enum(["pending_payment", "confirmed", "expired", "cancelled", "refunded"]).optional()
export const PaymentStatusFilter = z.enum(["pending", "processing", "success", "failed", "expired", "refunded"]).optional()
export const PartnerAppStatusFilter = z.enum(["received", "reviewing", "validated", "rejected"]).optional()

export const PaginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  q: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export const UserUpdateBody = z.object({
  role: AdminRoleFilter.optional(),
  status: z.string().optional(),
  firstName: z.string().max(100).optional().nullable(),
  lastName: z.string().max(100).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
})

export const UserParams = z.object({ id: z.string().cuid() })

export const TransporterUpdateBody = z.object({
  status: TransporterStatusFilter,
  vehicleCount: z.number().int().min(0).optional(),
})

export const TransporterParams = z.object({ id: z.string().cuid() })

export const TripAdminUpdateBody = z.object({
  price: z.number().int().min(1).optional(),
  totalSeats: z.number().int().min(1).max(200).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  departurePointInfo: z.string().max(200).optional().nullable(),
  conditions: z.string().max(1000).optional().nullable(),
  cancellationPolicy: z.string().max(500).optional().nullable(),
})

export const TripParams = z.object({ id: z.string().cuid() })

export const BookingParams = z.object({ id: z.string().cuid() })

export const PaymentParams = z.object({ id: z.string().cuid() })

export const PartnerAppParams = z.object({ id: z.string().cuid() })

export const PartnerAppReviewBody = z.object({
  status: z.enum(["reviewing", "validated", "rejected"]),
  message: z.string().max(1000).optional(),
})

export const BulkActionBody = z.object({
  ids: z.array(z.string().cuid()).min(1).max(100),
  action: z.enum(["cancel", "confirm", "approve", "reject", "activate", "deactivate"]).optional(),
})

export const CommissionParams = z.object({ id: z.string().cuid() })

export const AuditLogParams = z.object({ id: z.string().cuid() })

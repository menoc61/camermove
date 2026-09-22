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
  sort: z.string().optional(),
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

export const UserListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  q: z.string().optional(),
  role: z.enum(["traveler", "transporter_staff", "admin", "super_admin"]).optional(),
  status: z.enum(["active", "inactive", "pending"]).optional(),
})

export const TransporterListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  status: TransporterStatusFilter,
})

export const TripListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  q: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  transporterId: z.string().optional(),
})

export const BookingListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  q: z.string().optional(),
  status: z.enum(["pending_payment", "confirmed", "expired", "cancelled", "refunded"]).optional(),
  transporterId: z.string().optional(),
})

export const AdminSettingsBody = z.object({
  commissionPercent: z.number().min(0).max(100).optional(),
  holdExpiryMinutes: z.number().int().min(1).max(1440).optional(),
  cancellationPolicy: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional(),
  smtpUser: z.string().optional(),
  smtpFrom: z.string().optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
  maintenanceMode: z.boolean().optional(),
})

export const HotelParams = z.object({ id: z.string().cuid() })

export const HotelAdminUpdateBody = z.object({
  name: z.string().max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(120).optional(),
  region: z.string().max(120).optional().nullable(),
  country: z.string().max(120).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  starRating: z.coerce.number().int().min(0).max(5).optional().nullable(),
  amenities: z.array(z.string().max(100)).optional(),
  photos: z.array(z.string().url().max(2000)).optional(),
  status: z.string().max(50).optional(),
  partnerStatus: z.string().max(50).optional(),
})

export const RentalParams = z.object({ id: z.string().cuid() })

export const RentalAdminUpdateBody = z.object({
  category: z.string().max(100).optional(),
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  licensePlate: z.string().max(30).optional().nullable(),
  capacity: z.coerce.number().int().min(1).max(200).optional(),
  transmission: z.string().max(50).optional().nullable(),
  fuelType: z.string().max(50).optional().nullable(),
  hasDriver: z.coerce.boolean().optional(),
  pricePerUnit: z.coerce.number().int().min(1).optional(),
  durationUnit: z.enum(["hour", "day", "week", "month"]).optional(),
  currency: z.string().max(10).optional(),
  pickupCity: z.string().max(120).optional(),
  pickupAddress: z.string().max(300).optional().nullable(),
  photos: z.array(z.string().url().max(2000)).optional(),
  amenities: z.array(z.string().max(100)).optional(),
  status: z.enum(["available", "rented", "maintenance", "inactive"]).optional(),
  partnerStatus: z.string().max(50).optional(),
})

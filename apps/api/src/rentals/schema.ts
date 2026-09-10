import { z } from "zod"

export const RentalSearchQuery = z.object({
  city: z.string().optional(),
  pickupCity: z.string().optional(),
  category: z.string().optional(),
  hasDriver: z.coerce.boolean().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
})

export const CreateRentalBookingBody = z.object({
  rentalVehicleId: z.string().cuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue (YYYY-MM-DD)"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue (YYYY-MM-DD)"),
  pickupCity: z.string().min(1).max(100),
  pickupAddress: z.string().max(200).optional(),
  dropoffCity: z.string().min(1).max(100).optional(),
  dropoffAddress: z.string().max(200).optional(),
  driverName: z.string().max(100).optional(),
  driverPhone: z.string().max(20).optional(),
})

export const RentalBookingParams = z.object({ id: z.string().cuid() })

// Owner-scoped paginated rental bookings — powers the dashboard "Véhicules" tab.
// Per AGENTS.md §1/§6: page+perPage (default 20, max 100) returns the
// canonical { items, total, page, perPage, totalPages } envelope.
export const RentalBookingsListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  q: z.string().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export type CreateRentalBookingBody = z.infer<typeof CreateRentalBookingBody>
export type RentalBookingsListQuery = z.infer<typeof RentalBookingsListQuery>

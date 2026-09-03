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

export type CreateRentalBookingBody = z.infer<typeof CreateRentalBookingBody>

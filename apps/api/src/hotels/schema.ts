import { z } from "zod"

export const CreateHotelBookingBody = z.object({
  hotelId: z.string().cuid(),
  roomTypeId: z.string().cuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue (YYYY-MM-DD)"),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue (YYYY-MM-DD)"),
  guests: z.coerce.number().int().min(1).max(10),
  guestNames: z.array(z.string().min(1).max(100)).min(0).default([]),
  specialRequests: z.string().max(500).optional(),
})

export const HotelBookingParams = z.object({ id: z.string().cuid() })

export const HotelSearchQuery = z.object({
  city: z.string().optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  guests: z.coerce.number().int().min(1).max(20).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  orderBy: z.string().optional(),
  groupBy: z.string().optional(),
})

export type CreateHotelBookingBody = z.infer<typeof CreateHotelBookingBody>
export type HotelSearchQuery = z.infer<typeof HotelSearchQuery>

import { z } from "zod"

export const CreateBookingBody = z.object({
  tripId: z.string().cuid(),
  seatCount: z.coerce.number().int().min(1).max(10),
  passengers: z.array(z.object({ fullName: z.string().min(1).max(100), phone: z.string().optional() })).min(1),
})

export const BookingParams = z.object({ id: z.string().cuid() })

// Per AGENTS.md §1/§6: page+perPage query, canonical envelope { items, total, page, perPage, totalPages }.
export const MyBookingsListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  scope: z.enum(["upcoming", "history", "all"]).default("all"),
})

export const MyTicketsListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

export type CreateBookingBody = z.infer<typeof CreateBookingBody>
export type MyBookingsListQuery = z.infer<typeof MyBookingsListQuery>
export type MyTicketsListQuery = z.infer<typeof MyTicketsListQuery>

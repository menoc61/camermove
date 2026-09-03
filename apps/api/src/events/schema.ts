import { z } from "zod"

export const EventSearchQuery = z.object({
  search: z.string().optional(),
  city: z.string().optional(),
  eventType: z.enum(["concert", "sport", "conference", "festival", "theatre", "other"]).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  orderBy: z.string().optional(),
  groupBy: z.string().optional(),
})

export const CreateEventBookingSchema = z.object({
  eventId: z.string().cuid(),
  ticketCategoryId: z.string().cuid(),
  quantity: z.coerce.number().int().min(1).max(10),
})

export const EventBookingParams = z.object({ id: z.string().cuid() })

export const EventIdParams = z.object({ id: z.string().cuid() })

export type EventSearchQuery = z.infer<typeof EventSearchQuery>
export type CreateEventBookingInput = z.infer<typeof CreateEventBookingSchema>

import { z } from "zod"

export const CreateBookingBody = z.object({
  tripId: z.string().cuid(),
  seatCount: z.coerce.number().int().min(1).max(10),
  passengers: z.array(z.object({ fullName: z.string().min(1).max(100), phone: z.string().optional() })).min(1),
})

export const BookingParams = z.object({ id: z.string().cuid() })

export type CreateBookingBody = z.infer<typeof CreateBookingBody>

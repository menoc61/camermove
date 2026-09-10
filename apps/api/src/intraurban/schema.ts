import { z } from "zod"

export const ScheduleQuery = z.object({
  origin: z.string().optional(),
  dest: z.string().optional(),
  destination: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pax: z.coerce.number().int().min(1).default(1),
})

export type ScheduleQuery = z.infer<typeof ScheduleQuery>

import { z } from "zod"

export const AgencyQuery = z.object({
  city: z.string().min(1).max(100),
})

export type AgencyQuery = z.infer<typeof AgencyQuery>

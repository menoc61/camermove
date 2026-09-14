import { z } from "zod"

export const LandingRailType = z.enum([
  "transport",
  "hotels",
  "rentals",
  "events",
  "insurance",
])

export const LandingRailsQuery = z.object({
  type: LandingRailType,
})

export type LandingRailType = z.infer<typeof LandingRailType>
export type LandingRailsQuery = z.infer<typeof LandingRailsQuery>

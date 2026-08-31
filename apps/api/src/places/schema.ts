import { z } from "zod"

export const PlacesAutocompleteQuery = z.object({
  q: z.string().min(1).max(100),
  countrycodes: z.string().default("cm"),
  limit: z.coerce.number().int().min(1).max(10).default(5),
})

export type PlacesAutocompleteQuery = z.infer<typeof PlacesAutocompleteQuery>

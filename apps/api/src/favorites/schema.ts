import { z } from "zod"

export const FavoriteKindSchema = z.enum(["hotel", "rental", "event"])

export const CreateFavoriteBody = z.object({
  kind: FavoriteKindSchema,
  entityId: z.string().cuid(),
})

export const FavoriteListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
})

export const FavoriteParams = z.object({ id: z.string().cuid() })

export type FavoriteKind = z.infer<typeof FavoriteKindSchema>
export type CreateFavoriteBody = z.infer<typeof CreateFavoriteBody>
export type FavoriteListQuery = z.infer<typeof FavoriteListQuery>
export type FavoriteParams = z.infer<typeof FavoriteParams>

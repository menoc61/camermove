import type { FastifyInstance } from "fastify"
import { CreateFavoriteBody, FavoriteListQuery, FavoriteParams } from "./schema.js"
import { addFavorite, listFavorites, removeFavorite } from "./service.js"
import { buildPagination } from "../lib/query.js"

export async function favoriteRoutes(app: FastifyInstance) {
  // GET /favorites — owner list, canonical {items,total,page,perPage,totalPages}
  app.get("/favorites", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
    const q = FavoriteListQuery.parse(req.query)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const pagination = buildPagination({ page: q.page, perPage: q.perPage })
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.(
      { ...meta, userId: user.id, page: q.page, perPage: q.perPage },
      "favorites.list",
    )
    const { items, total } = await listFavorites(user.id, pagination.skip, pagination.take)
    const page = pagination.page ?? q.page
    const perPage = pagination.take
    return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) }
  })

  // POST /favorites — 201 on create, 200 with existing row on replay
  app.post("/favorites", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req, reply) => {
    const body = CreateFavoriteBody.parse(req.body)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.(
      { ...meta, userId: user.id, kind: body.kind, entityId: body.entityId },
      "favorites.create",
    )
    const { favorite, created } = await addFavorite({ userId: user.id, kind: body.kind, entityId: body.entityId })
    return reply.code(created ? 201 : 200).send(favorite)
  })

  // DELETE /favorites/:id — owner or admin, 204 on success, 404 otherwise
  app.delete("/favorites/:id", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req, reply) => {
    const { id } = FavoriteParams.parse(req.params)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.(
      { ...meta, userId: user.id, entityId: id },
      "favorites.delete",
    )
    await removeFavorite({ id, userId: user.id, role: user.role })
    return reply.code(204).send()
  })
}

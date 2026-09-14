/**
 * GET /api/v1/me/notifications — owner-scoped paginated notifications.
 * PATCH /api/v1/me/notifications/:id/read — mark one notification as read.
 *
 * Per AGENTS.md §2: req.log.info with req.meta + userId/notificationId.
 * Per AGENTS.md §5: no schema migration here — the Notification model has no
 * `read` column, so the read flag lives in `payload.read` (JSON merge).
 * Canonical envelope: { items, total, page, perPage, totalPages }.
 */
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { prisma } from "@camermove/db"
import { NotFoundError } from "@camermove/config"

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const IdParams = z.object({ id: z.string().cuid() })

function withReadFlag<T extends { payload: unknown }>(n: T): T & { read: boolean } {
  const payload = (n.payload ?? {}) as Record<string, unknown>
  return { ...n, read: payload.read === true }
}

export async function meNotificationRoutes(app: FastifyInstance) {
  app.get("/me/notifications", { preHandler: app.requireAuth() }, async (req) => {
    const query = ListQuery.parse(req.query)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id, page: query.page, perPage: query.perPage }, "me.notifications.list")

    // AGENTS.md §6: periodic list → dateFrom/dateTo filter on createdAt.
    // No /me/notifications/export endpoint (owner-scoped, low volume) — gap
    // documented here instead of a dead export stub.
    const where: Record<string, unknown> = { userId: user.id }
    if (query.dateFrom || query.dateTo) {
      const createdAt: Record<string, Date> = {}
      if (query.dateFrom) createdAt.gte = new Date(query.dateFrom)
      if (query.dateTo) createdAt.lte = new Date(query.dateTo + "T23:59:59Z")
      where.createdAt = createdAt
    }
    const take = query.perPage
    const skip = (query.page - 1) * take
    const [rows, total] = await Promise.all([
      prisma.notification.findMany({
        where: where as never,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: { id: true, channel: true, type: true, status: true, payload: true, sentAt: true, createdAt: true },
      }),
      prisma.notification.count({ where: where as never }),
    ])
    return {
      items: rows.map(withReadFlag),
      total,
      page: query.page,
      perPage: take,
      totalPages: Math.ceil(total / take),
    }
  })

  app.patch("/me/notifications/:id/read", { preHandler: app.requireAuth() }, async (req) => {
    const { id } = IdParams.parse(req.params)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id, notificationId: id }, "me.notifications.read")

    // Owner-scoped fetch first: 404 (not 403) to avoid leaking existence.
    const existing = await prisma.notification.findFirst({ where: { id, userId: user.id } })
    if (!existing) throw new NotFoundError("Notification introuvable")

    const payload = { ...((existing.payload ?? {}) as Record<string, unknown>), read: true }
    const updated = await prisma.notification.update({ where: { id }, data: { payload: payload as never } })
    return withReadFlag(updated)
  })
}

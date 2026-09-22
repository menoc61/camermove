import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { prisma } from "@camermove/db"
import { loadEnv } from "@camermove/config"
import { parseExportQuery, sendExport } from "../lib/export.js"

const NewsletterBody = z.object({
  email: z.string().email().max(254).transform((v) => v.trim().toLowerCase()),
})

export async function newsletterRoutes(app: FastifyInstance) {
  app.post("/newsletter", async (req, reply) => {
    const body = NewsletterBody.parse((req as { body: unknown }).body)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    req.log.info({ ...meta, email: body.email }, "newsletter.subscribe")

    // Idempotent per normalized email: replay returns the same result without
    // creating a duplicate subscription record.
    const existing = await prisma.notification.findFirst({
      where: {
        type: "newsletter.subscribe",
        payload: { path: ["email"], equals: body.email },
      },
      select: { id: true },
    })
    if (existing) {
      return reply.code(200).send({ alreadySubscribed: true, email: body.email })
    }

    await prisma.notification.create({
      data: {
        channel: "email",
        type: "newsletter.subscribe",
        payload: {
          email: body.email,
          ip: (meta as Record<string, unknown>).ip,
          requestId: (meta as Record<string, unknown>).requestId,
        } as never,
      },
    })
    return reply.code(201).send({ alreadySubscribed: false, email: body.email })
  })

  // DELETE /newsletter — public unsubscribe by email (link-safe, no auth)
  app.delete("/newsletter", async (req) => {
    const body = NewsletterBody.parse((req as { body: unknown }).body)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    req.log.info({ ...meta, email: body.email }, "newsletter.unsubscribe")
    const removed = await prisma.notification.deleteMany({
      where: { type: "newsletter.subscribe", payload: { path: ["email"], equals: body.email } },
    })
    return { unsubscribed: removed.count > 0, email: body.email }
  })

  // GET /admin/newsletter — subscriptions are Notification rows (type newsletter.subscribe)
  app.get("/admin/newsletter", { preHandler: (app as unknown as { requireAuth: (role?: string) => unknown }).requireAuth("admin") as never }, async (req) => {
    const query = req.query as Record<string, unknown>
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    const page = Math.max(1, Number(query.page ?? 1))
    const perPage = Math.min(50, Math.max(1, Number(query.perPage ?? 20)))
    req.log.info({ ...meta, actorId: user.id, page }, "admin.newsletter.list")
    const where = { type: "newsletter.subscribe" }
    const [items, total] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
      prisma.notification.count({ where }),
    ])
    return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) }
  })

  app.get("/admin/newsletter/export", { preHandler: (app as unknown as { requireAuth: (role?: string) => unknown }).requireAuth("admin") as never }, async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    req.log.info({ ...meta, actorId: user.id, dateFrom, dateTo, format }, "admin.newsletter.export")
    const env = loadEnv()
    const where: Record<string, unknown> = { type: "newsletter.subscribe" }
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(`${dateTo}T23:59:59Z`)
      where.createdAt = createdAt
    }
    const rows = await prisma.notification.findMany({ where: where as never, take: env.SEARCH_MAX_LIMIT, orderBy: { createdAt: "desc" } })
    const flat = (rows as unknown as Array<{ payload?: Record<string, unknown> }>).map((n) => ({
      ...(n as unknown as Record<string, unknown>),
      email: (n.payload?.email as string | undefined) ?? "",
    }))
    return sendExport(reply, "newsletter", dateFrom, dateTo, format, flat, ["id", "createdAt", "email"])
  })
}

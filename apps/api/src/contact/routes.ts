import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { prisma } from "@camermove/db"
import { loadEnv } from "@camermove/config"
import { parseExportQuery, sendExport } from "../lib/export.js"

const ContactBody = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  message: z.string().min(10).max(2000),
})

export async function contactRoutes(app: FastifyInstance) {
  app.post("/contact", async (req, reply) => {
    const body = ContactBody.parse((req as { body: unknown }).body)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    req.log.info({ ...meta, email: body.email }, "contact.submit")
    // Queue a support notification (userId null for anonymous contact) —
    // surfaced in the back-office notifications/support queue
    await prisma.notification.create({
      data: {
        channel: "email",
        type: "contact.submit",
        payload: {
          name: body.name,
          email: body.email,
          message: body.message,
          ip: (meta as Record<string, unknown>).ip,
          requestId: (meta as Record<string, unknown>).requestId,
        } as never,
      },
    })
    return reply.code(201).send({ status: "received" })
  })

  // GET /admin/contact — submissions are Notification rows (type contact.submit)
  app.get("/admin/contact", { preHandler: (app as unknown as { requireAuth: (role?: string) => unknown }).requireAuth("admin") as never }, async (req) => {
    const query = req.query as Record<string, unknown>
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    const page = Math.max(1, Number(query.page ?? 1))
    const perPage = Math.min(50, Math.max(1, Number(query.perPage ?? 20)))
    req.log.info({ ...meta, actorId: user.id, page }, "admin.contact.list")
    const where = { type: "contact.submit" }
    const [items, total] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
      prisma.notification.count({ where }),
    ])
    return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) }
  })

  app.get("/admin/contact/export", { preHandler: (app as unknown as { requireAuth: (role?: string) => unknown }).requireAuth("admin") as never }, async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    req.log.info({ ...meta, actorId: user.id, dateFrom, dateTo, format }, "admin.contact.export")
    const env = loadEnv()
    const where: Record<string, unknown> = { type: "contact.submit" }
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(`${dateTo}T23:59:59Z`)
      where.createdAt = createdAt
    }
    const rows = await prisma.notification.findMany({ where: where as never, take: env.SEARCH_MAX_LIMIT, orderBy: { createdAt: "desc" } })
    const flat = (rows as unknown as Array<{ payload?: Record<string, unknown> }>).map((n) => ({
      ...(n as unknown as Record<string, unknown>),
      name: (n.payload?.name as string | undefined) ?? "",
      email: (n.payload?.email as string | undefined) ?? "",
      message: (n.payload?.message as string | undefined) ?? "",
    }))
    return sendExport(reply, "contact", dateFrom, dateTo, format, flat, ["id", "createdAt", "name", "email", "message"])
  })
}

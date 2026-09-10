import type { FastifyInstance } from "fastify"
import { prisma } from "@camermove/db"
import { loadEnv } from "@camermove/config"
import { getStorage } from "@camermove/media"
import { ApplicationInput, PresignInput } from "./schema"
import { createPartnerApplicationsService } from "./service"
import * as repo from "./repository"
import { parseExportQuery, sendExport } from "../lib/export"

export async function partnerApplicationRoutes(app: FastifyInstance) {
  const env = loadEnv()
  const svc = createPartnerApplicationsService({ storage: getStorage(), prisma })

  app.post(
    "/partner-applications/presign",
    { preHandler: app.requireAuth() },
    async (req) => {
      const input = PresignInput.parse(req.body)
      const user = (req as unknown as { user: { id: string; role: string } }).user
      const meta = (req as unknown as { meta: Record<string, unknown> }).meta
      req.log.info({ ...meta, userId: user.id, docType: input.type }, "partner.application.presign")
      return svc.presignDocument(user.id, input)
    },
  )

  app.post("/partner-applications", { preHandler: app.requireAuth() }, async (req, reply) => {
    const input = ApplicationInput.parse(req.body)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info(
      { ...meta, userId: user.id, docCount: input.documents.length },
      "partner.application.submit",
    )
    const out = await svc.submit(user.id, input)
    try {
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "partner.application.submit",
          entityType: "PartnerApplication",
          entityId: out.id,
          metadata: { docCount: input.documents.length, companyName: input.companyName } as never,
        },
      })
    } catch (err) {
      // audit best-effort; submission must not fail because of audit write
      req.log.warn({ err }, "audit.write.failed")
    }
    return reply.code(201).send(out)
  })

  app.get("/partner-applications/me", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id, entityId: user.id }, "partner.application.me")
    return svc.getMyApplication(user.id)
  })

  // GET /partner-applications/export — §6 style: admin sees all, others owner-scoped
  app.get("/partner-applications/export", { preHandler: app.requireAuth() }, async (req, reply) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id, dateFrom, dateTo, format }, "partner.application.export")
    const isAdmin = user.role === "admin" || user.role === "super_admin"
    let rows: Record<string, unknown>[]
    if (isAdmin) {
      rows = (await svc.listForExport({ dateFrom, dateTo, limit: env.SEARCH_MAX_LIMIT })) as unknown as Record<string, unknown>[]
    } else {
      const u = await repo.findUserById(prisma, user.id)
      if (!u?.transporterId) rows = []
      else {
        rows = (await svc.listForExport({
          dateFrom,
          dateTo,
          limit: env.SEARCH_MAX_LIMIT,
          transporterId: u.transporterId,
        })) as unknown as Record<string, unknown>[]
      }
    }
    const columns = ["id", "companyName", "contactName", "phone", "email", "city", "transportType", "vehicleCount", "status", "createdAt"]
    return sendExport(reply, "partner-applications", dateFrom, dateTo, format, rows, columns)
  })
}

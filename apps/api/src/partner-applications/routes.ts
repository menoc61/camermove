import type { FastifyInstance } from "fastify"
import { prisma } from "@camermove/db"
import { getStorage } from "@camermove/media"
import { ApplicationInput, PresignInput } from "./schema"
import { createPartnerApplicationsService } from "./service"

export async function partnerApplicationRoutes(app: FastifyInstance) {
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
}

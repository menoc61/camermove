import type { FastifyInstance } from "fastify"
import { loadEnv } from "@camermove/config"
import { createStorage } from "@camermove/media"
import { PresignInput } from "./schema"
import { createPartnerApplicationsService } from "./service"

export async function partnerApplicationRoutes(app: FastifyInstance) {
  const env = loadEnv()
  const storage = createStorage(env)
  const svc = createPartnerApplicationsService({ env, storage })

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
}

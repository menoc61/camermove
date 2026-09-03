import type { FastifyInstance } from "fastify"
import { z } from "zod"

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
    // In prod: persist to DB or send via Notification/email. For MVP: log + ok.
    return reply.code(201).send({ ok: true })
  })
}

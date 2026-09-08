import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { prisma } from "@camermove/db"

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
    return reply.code(201).send({ ok: true })
  })
}

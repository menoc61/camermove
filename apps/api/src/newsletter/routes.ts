import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { prisma } from "@camermove/db"

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
      return reply.code(200).send({ ok: true, alreadySubscribed: true })
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
    return reply.code(201).send({ ok: true, alreadySubscribed: false })
  })
}

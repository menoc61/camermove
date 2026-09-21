import type { FastifyInstance } from "fastify"
import { z } from "zod"

const UpdateProfileBody = z.object({
  firstName: z.string().min(2).max(80).optional(),
  lastName: z.string().min(2).max(80).optional(),
  phone: z.string().min(6).max(20).optional(),
})

export async function meProfileRoutes(app: FastifyInstance) {
  app.get("/me/profile", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id }, "me.profile")
    const { prisma } = await import("@camermove/db")
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, role: true, status: true },
    })
    if (!row || row.status !== "active") {
      const { UnauthorizedError } = await import("@camermove/config")
      throw new UnauthorizedError()
    }
    return row
  })

  app.patch("/me/profile", { preHandler: app.requireAuth() }, async (req) => {
    const body = UpdateProfileBody.parse(req.body ?? {})
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id }, "me.profile.update")
    const { prisma } = await import("@camermove/db")
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(body.firstName ? { firstName: body.firstName } : {}),
        ...(body.lastName ? { lastName: body.lastName } : {}),
        ...(body.phone ? { phone: body.phone } : {}),
      },
      select: { id: true, email: true, role: true, status: true },
    })
    return updated
  })
}

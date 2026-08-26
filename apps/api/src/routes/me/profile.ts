import type { FastifyInstance } from "fastify"

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
}

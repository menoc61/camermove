import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { prisma } from "@camermove/db"

const UpdateSettingsBody = z.object({
  commissionPercent: z.number().min(0).max(100).optional(),
  holdExpiryMinutes: z.number().int().min(1).max(1440).optional(),
  cancellationPolicy: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional(),
  smtpUser: z.string().optional(),
  smtpFrom: z.string().optional(),
  featureFlags: z.record(z.boolean()).optional(),
  maintenanceMode: z.boolean().optional(),
})

export async function adminSettingsRoutes(app: FastifyInstance) {
  app.get("/admin/settings", { preHandler: app.requireAuth("super_admin") }, async (req) => {
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId: (req as unknown as { user: { id: string } }).user.id }, "admin.settings.get")
    let settings = await prisma.appSettings.findUnique({ where: { id: "global" } })
    if (!settings) {
      settings = await prisma.appSettings.create({ data: { id: "global" } })
    }
    return settings
  })

  app.put("/admin/settings", { preHandler: app.requireAuth("super_admin") }, async (req) => {
    const body = UpdateSettingsBody.parse(req.body)
    const actorId = (req as unknown as { user: { id: string } }).user.id
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, actorId, ...body }, "admin.settings.update")
    const settings = await prisma.appSettings.upsert({
      where: { id: "global" },
      update: { ...body, updatedBy: actorId },
      create: { id: "global", ...body, updatedBy: actorId },
    })
    await prisma.auditLog.create({
      data: { actorId, action: "admin.settings.update", entityType: "AppSettings", entityId: "global", metadata: body as never },
    })
    return settings
  })
}

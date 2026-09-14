/**
 * GET /api/v1/me/partner-services — which services the authenticated user
 * partners on, with per-service KPIs. Powers the /partner hub: services the
 * user does NOT own are absent from the response, so the UI never shows a
 * dashboard for a service the user is not a partner on.
 */
import type { FastifyInstance } from "fastify"
import { getPartnerServices } from "./service.js"

export async function partnerServiceRoutes(app: FastifyInstance) {
  app.get("/me/partner-services", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta
    req.log.info({ ...meta, userId: user.id }, "me.partner-services")
    return getPartnerServices(user.id)
  })
}

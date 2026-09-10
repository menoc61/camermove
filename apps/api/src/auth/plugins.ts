import fp from "fastify-plugin"
import type { FastifyInstance, FastifyRequest } from "fastify"
import { verifyAccessToken } from "./tokens"
import { loadEnv } from "@camermove/config"
import { ForbiddenError, UnauthorizedError } from "@camermove/config"

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; role: string }
  }
  interface FastifyInstance {
    requireAuth: (role?: string) => (req: FastifyRequest) => Promise<void>
  }
}

const env = loadEnv()

// Role hierarchy (AGENTS.md RBAC): higher roles satisfy lower gates.
// super_admin ≥ admin ≥ transporter_staff ≥ traveler
const ROLE_RANK: Record<string, number> = {
  traveler: 0,
  transporter_staff: 1,
  admin: 2,
  super_admin: 3,
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorate("requireAuth", function (role?: string) {
    return async (req: FastifyRequest) => {
      const header = req.headers.authorization
      if (!header?.startsWith("Bearer ")) throw new UnauthorizedError()
      const token = header.slice(7)
      const claims = verifyAccessToken(token, env)
      if (role && (ROLE_RANK[claims.role] ?? -1) < (ROLE_RANK[role] ?? 0)) throw new ForbiddenError()
      req.user = { id: claims.sub, role: claims.role }
    }
  })
})

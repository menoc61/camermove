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

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorate("requireAuth", function (role?: string) {
    return async (req: FastifyRequest) => {
      const header = req.headers.authorization
      if (!header?.startsWith("Bearer ")) throw new UnauthorizedError()
      const token = header.slice(7)
      const claims = verifyAccessToken(token, env)
      if (role && claims.role !== role) throw new ForbiddenError()
      req.user = { id: claims.sub, role: claims.role }
    }
  })
})

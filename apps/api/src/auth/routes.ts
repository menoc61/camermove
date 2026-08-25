import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { findUserByEmail, createUser, findOrCreateSocialUser } from "@camermove/db"
import { loadEnv, ConflictError, UnauthorizedError } from "@camermove/config"
import { hashPassword, verifyPassword } from "./password"
import { signTokens } from "./tokens"
import { googleProvider } from "./social"
import { randomUUID } from "node:crypto"

const env = loadEnv()

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (req, reply) => {
    const body = RegisterBody.parse(req.body)
    const existing = await findUserByEmail(body.email)
    if (existing) throw new ConflictError("Un compte existe déjà avec cet email")
    const passwordHash = await hashPassword(body.password)
    const user = await createUser({
      email: body.email,
      passwordHash,
      firstName: body.firstName,
      lastName: body.lastName,
    })
    const tokens = signTokens(user, env)
    return reply.code(201).send({ user: { id: user.id, email: user.email, role: user.role }, ...tokens })
  })

  app.post("/auth/login", async (req) => {
    const body = RegisterBody.pick({ email: true, password: true }).parse(req.body)
    const user = await findUserByEmail(body.email)
    if (!user?.passwordHash) throw new UnauthorizedError()
    const ok = await verifyPassword(user.passwordHash, body.password)
    if (!ok) throw new UnauthorizedError()
    const tokens = signTokens(user, env)
    return { user: { id: user.id, email: user.email, role: user.role }, ...tokens }
  })

  app.post("/auth/refresh", async () => {
    return { ok: true }
  })

  app.get("/auth/me", { preHandler: (app as unknown as { requireAuth: (r?: string) => never }).requireAuth() }, async (req) => {
    return { user: (req as unknown as { user: unknown }).user }
  })

  app.get("/auth/google", async (_req, reply) => {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_CALLBACK_URL) {
      return reply.code(501).send({ error: "GOOGLE_OAUTH_NOT_CONFIGURED", message: "Google OAuth non configuré" })
    }
    const state = randomUUID()
    const url = googleProvider.getAuthUrl(state)
    return reply.redirect(url)
  })

  app.get("/auth/google/callback", async (req, reply) => {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return reply.code(501).send({ error: "GOOGLE_OAUTH_NOT_CONFIGURED" })
    }
    const query = req.query as { code?: string }
    if (!query.code) throw new UnauthorizedError("Code manquant")
    const { id_token } = await googleProvider.exchangeCode(query.code)
    const profile = googleProvider.verifyIdToken(id_token)
    const user = await findOrCreateSocialUser({
      email: profile.email,
      provider: "google",
      providerUserId: profile.sub,
      name: profile.name,
    })
    const tokens = signTokens(user, env)
    return reply.send({ user: { id: user.id, email: user.email, role: user.role }, ...tokens })
  })
}

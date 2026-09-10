import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { findUserByEmail, findUserById, createUser, findOrCreateSocialUser } from "@camermove/db"
import { loadEnv, ConflictError, UnauthorizedError } from "@camermove/config"
import { hashPassword, verifyPassword } from "./password"
import {
  issueTokenPair,
  verifyRefreshToken,
  getRefreshRecord,
  consumeRefreshRecord,
  isRefreshDenied,
  isRefreshRotated,
  denyRefreshJti,
  revokeTokenFamily,
} from "./tokens"
import { googleProvider } from "./social"
import { randomUUID, createHash } from "node:crypto"

const env = loadEnv()

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})

const RefreshBody = z.object({
  refreshToken: z.string().min(1),
})

const LogoutBody = z.object({
  refreshToken: z.string().min(1).optional(),
})

function hashEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex")
}

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
    const tokens = await issueTokenPair(user, env)
    req.log.info({ ...req.meta, emailHash: hashEmail(user.email), userId: user.id }, "auth.register")
    return reply.code(201).send({ user: { id: user.id, email: user.email, role: user.role }, ...tokens })
  })

  app.post("/auth/login", async (req) => {
    const body = RegisterBody.pick({ email: true, password: true }).parse(req.body)
    const user = await findUserByEmail(body.email)
    if (!user?.passwordHash) throw new UnauthorizedError()
    const ok = await verifyPassword(user.passwordHash, body.password)
    if (!ok) throw new UnauthorizedError()
    const tokens = await issueTokenPair(user, env)
    req.log.info({ ...req.meta, emailHash: hashEmail(user.email), userId: user.id }, "auth.login")
    return { user: { id: user.id, email: user.email, role: user.role }, ...tokens }
  })

  app.post("/auth/refresh", async (req) => {
    const parsed = RefreshBody.safeParse(req.body)
    if (!parsed.success) throw new UnauthorizedError("Refresh token manquant")
    const claims = verifyRefreshToken(parsed.data.refreshToken, env)
    if (await isRefreshDenied(claims.jti)) throw new UnauthorizedError("Session révoquée")
    const storedUserId = await getRefreshRecord(claims.jti)
    if (storedUserId !== claims.sub) {
      // No live record for a validly-signed jti: replay of an already-rotated
      // token (theft) or an unknown jti. Nuke the family only on proven reuse.
      if (storedUserId === null && (await isRefreshRotated(claims.jti)) !== null) {
        await revokeTokenFamily(claims.sub)
        req.log.info({ ...req.meta, userId: claims.sub }, "auth.refresh.reuse-detected")
      }
      throw new UnauthorizedError("Refresh token invalide")
    }
    const user = await findUserById(claims.sub)
    if (!user) throw new UnauthorizedError("Refresh token invalide")
    await consumeRefreshRecord(claims.jti, user.id)
    const tokens = await issueTokenPair(user, env)
    req.log.info({ ...req.meta, userId: user.id }, "auth.refresh")
    return { user: { id: user.id, email: user.email, role: user.role }, ...tokens }
  })

  app.post("/auth/logout", { preHandler: (app as unknown as { requireAuth: (r?: string) => never }).requireAuth() }, async (req) => {
    const userId = (req as unknown as { user: { id: string } }).user.id
    const parsed = LogoutBody.safeParse(req.body)
    const refreshToken = parsed.success ? parsed.data.refreshToken : undefined
    if (refreshToken) {
      try {
        const claims = verifyRefreshToken(refreshToken, env)
        await denyRefreshJti(claims.jti)
      } catch {
        // best-effort: an unusable refresh token is already effectively dead
      }
    }
    req.log.info({ ...req.meta, userId }, "auth.logout")
    return { loggedOut: true }
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
    // Social logins join refresh rotation + family tracking like password logins.
    const tokens = await issueTokenPair(user, env)
    req.log.info({ ...req.meta, userId: user.id }, "auth.google.callback")
    return reply.send({ user: { id: user.id, email: user.email, role: user.role }, ...tokens })
  })
}

import fp from "fastify-plugin"
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"
import { getRedis } from "../lib/redis"

// Idempotency: clients send Idempotency-Key header for POST/PUT/PATCH.
// We store response for 24h keyed by key+route. Replay returns same response without re-executing.
// Uses Redis if available, falls back to in-memory Map for dev without Redis.

const memoryStore = new Map<string, { status: number; body: unknown; headers: Record<string, string> }>()

export const idempotencyPlugin = fp(async (app: FastifyInstance) => {
  app.addHook("preHandler", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!["POST", "PUT", "PATCH"].includes(req.method)) return
    const key = req.headers["idempotency-key"] as string | undefined
    if (!key) return
    const cacheKey = `idemp:${req.url}:${key}`

    let cached: { status: number; body: unknown; headers: Record<string, string> } | null = null
    try {
      const raw = await getRedis().get(cacheKey)
      if (raw) cached = JSON.parse(raw)
    } catch {
      cached = memoryStore.get(cacheKey) ?? null
    }

    if (cached) {
      for (const [k, v] of Object.entries(cached.headers)) reply.header(k, v as string)
      return reply.code(cached.status).send(cached.body)
    }

    const originalSend = reply.send.bind(reply)
    // @ts-ignore - monkey patch send to capture
    reply.send = (payload: unknown) => {
      const status = reply.statusCode
      const headers = reply.getHeaders() as Record<string, string>
      const toCache = { status, body: payload, headers }
      getRedis()
        .setex(cacheKey, 86400, JSON.stringify(toCache))
        .catch(() => memoryStore.set(cacheKey, toCache))
      return originalSend(payload)
    }
  })
})

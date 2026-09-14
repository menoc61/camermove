import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../../app"
import { loadEnv } from "@camermove/config"
import { signTokens } from "../../auth/tokens"

// In-memory cache mock: deterministic dashboard caching without Redis.
vi.mock("../../lib/cache.js", () => {
  const store = new Map<string, string>()
  return {
    getCached: vi.fn(async (key: string) => {
      const raw = store.get(key)
      return raw ? (JSON.parse(raw) as unknown) : null
    }),
    setCached: vi.fn(async (key: string, value: unknown) => {
      store.set(key, JSON.stringify(value))
    }),
    invalidateCache: vi.fn(async (pattern: string) => {
      const prefix = pattern.replace("*", "")
      for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k)
    }),
    cacheKey: (p: string, params: Record<string, unknown>) => `${p}:${JSON.stringify(params)}`,
  }
})

let app: FastifyInstance
const createdUserIds: string[] = []

beforeAll(async () => {
  app = await buildApp()
})

afterAll(async () => {
  const { prisma } = await import("@camermove/db")
  for (const id of createdUserIds) {
    await prisma.auditLog.deleteMany({ where: { actorId: id } }).catch(() => {})
    await prisma.user.delete({ where: { id } }).catch(() => {})
  }
  await app?.close()
})

async function createTraveler(prefix: string): Promise<{ id: string; token: string }> {
  const env = loadEnv()
  const { prisma } = await import("@camermove/db")
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.cm`
  const created = await prisma.user.create({
    data: { email, passwordHash: "x", role: "traveler" },
  })
  createdUserIds.push(created.id)
  const { accessToken } = signTokens({ id: created.id, role: "traveler" }, env)
  return { id: created.id, token: accessToken }
}

describe("GET /me/dashboard", () => {
  it("401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/me/dashboard" })
    expect(res.statusCode).toBe(401)
  })

  it("200 with valid token returns {upcoming,history,tickets}", async () => {
    const { token } = await createTraveler("plan-dashboard")
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/me/dashboard",
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { upcoming: unknown[]; history: unknown[]; tickets: unknown[] }
    expect(body).toHaveProperty("upcoming")
    expect(body).toHaveProperty("history")
    expect(body).toHaveProperty("tickets")
    expect(Array.isArray(body.upcoming)).toBe(true)
    expect(Array.isArray(body.history)).toBe(true)
    expect(Array.isArray(body.tickets)).toBe(true)
  })

  it("empty-user returns empty arrays", async () => {
    const { token } = await createTraveler("plan-dashboard-empty")
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/me/dashboard",
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { upcoming: unknown[]; history: unknown[]; tickets: unknown[] }
    expect(body.upcoming).toEqual([])
    expect(body.history).toEqual([])
    expect(body.tickets).toEqual([])
  })

  it("2nd request is served from cache (cache hit flag) and fast", async () => {
    const { token } = await createTraveler("plan-dashboard-cache")
    const auth = { authorization: `Bearer ${token}` }

    const first = await app.inject({ method: "GET", url: "/api/v1/me/dashboard", headers: auth })
    expect(first.statusCode).toBe(200)
    const firstBody = first.json() as Record<string, unknown>
    expect(firstBody).toHaveProperty("upcoming")

    const start = Date.now()
    const second = await app.inject({ method: "GET", url: "/api/v1/me/dashboard", headers: auth })
    const elapsed = Date.now() - start

    expect(second.statusCode).toBe(200)
    const secondBody = second.json() as Record<string, unknown>
    // Cache hit flag (hot path no longer hits the DB on repeat reads).
    expect((secondBody.meta as { cached: boolean } | undefined)?.cached).toBe(true)
    // Same payload as the miss (excluding the meta flag).
    const { meta: _m1, ...rest1 } = firstBody
    const { meta: _m2, ...rest2 } = secondBody
    expect(rest2).toEqual(rest1)
    // Cached read must not block: well under 500ms.
    expect(elapsed).toBeLessThan(500)
  })

  it("audit log write does not block the response", async () => {
    const { token } = await createTraveler("plan-dashboard-audit")
    const { prisma } = await import("@camermove/db")
    // Stall the audit write 1s: a blocking (awaited) write would push RTT over budget.
    const spy = vi.spyOn(prisma.auditLog, "create").mockImplementation((async () => {
      await new Promise((r) => setTimeout(r, 1000))
      return {} as never
    }) as never)

    try {
      const start = Date.now()
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/me/dashboard",
        headers: { authorization: `Bearer ${token}` },
      })
      const elapsed = Date.now() - start
      expect(res.statusCode).toBe(200)
      // Fire-and-forget audit => response returns without waiting out the 1s write.
      expect(elapsed).toBeLessThan(500)
      expect(spy).toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})

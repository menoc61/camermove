import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"
import { loadEnv } from "@camermove/config"
import { signTokens } from "../auth/tokens"
import { parseAdminSort } from "./service"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

describe("parseAdminSort", () => {
  it("accepts allowlisted field.dir", () => {
    expect(parseAdminSort("email.asc", ["email", "createdAt"], { createdAt: "desc" })).toEqual({ email: "asc" })
  })

  it("falls back on unknown field", () => {
    expect(parseAdminSort("hacker.desc", ["email"], { createdAt: "desc" })).toEqual({ createdAt: "desc" })
  })
})

describe("GET /admin/users sorting", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/users?sort=email.asc" })
    expect(res.statusCode).toBe(401)
  })

  it("route accepts sort param (not Fastify 404 body)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/users?sort=email.asc" })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})

describe("GET /admin/users sorting applies", () => {
  it("?sort=email.asc returns emails ascending (seeded reorder proof)", async () => {
    const { prisma } = await import("@camermove/db")
    const env = loadEnv()
    // Unique prefix per run keeps reruns collision-free; suffixes a/b give deterministic order.
    const prefix = `sorttest-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const emailB = `${prefix}-b@x.cm`
    const emailA = `${prefix}-a@x.cm`
    const createdIds: string[] = []
    try {
      // Seed in reverse order (b first) so ordering must come from ?sort=, not insertion.
      for (const email of [emailB, emailA]) {
        const u = await prisma.user.create({ data: { email, passwordHash: "x", role: "traveler" } })
        createdIds.push(u.id)
      }
      const adminEmail = `${prefix}-admin@x.cm`
      const admin = await prisma.user.create({
        data: { email: adminEmail, passwordHash: "x", role: "admin" },
      })
      createdIds.push(admin.id)
      const { accessToken } = signTokens({ id: admin.id, role: "admin" }, env)
      const headers = { authorization: `Bearer ${accessToken}` }

      const asc = await app.inject({
        method: "GET",
        url: `/api/v1/admin/users?q=${prefix}&sort=email.asc&limit=10`,
        headers,
      })
      expect(asc.statusCode).toBe(200)
      const ascEmails = (asc.json().items as Array<{ email: string }>)
        .map((i) => i.email)
        .filter((e) => e.startsWith(prefix))
      // Admin seed row also matches q; "-a@" < "-admin" < "-b" lexicographically.
      expect(ascEmails).toEqual([emailA, adminEmail, emailB])

      const desc = await app.inject({
        method: "GET",
        url: `/api/v1/admin/users?q=${prefix}&sort=email.desc&limit=10`,
        headers,
      })
      expect(desc.statusCode).toBe(200)
      const descEmails = (desc.json().items as Array<{ email: string }>)
        .map((i) => i.email)
        .filter((e) => e.startsWith(prefix))
      expect(descEmails).toEqual([emailB, adminEmail, emailA])
    } finally {
      for (const id of createdIds) {
        await prisma.auditLog.deleteMany({ where: { actorId: id } }).catch(() => {})
        await prisma.user.delete({ where: { id } }).catch(() => {})
      }
    }
  })
})

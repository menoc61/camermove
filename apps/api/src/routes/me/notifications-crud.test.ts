import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../../app"
import { loadEnv } from "@camermove/config"
import { signTokens } from "../../auth/tokens"

let app: FastifyInstance
const createdUserIds: string[] = []
beforeAll(async () => { app = await buildApp() })
afterAll(async () => {
  const { prisma } = await import("@camermove/db")
  for (const id of createdUserIds) {
    await prisma.notification.deleteMany({ where: { userId: id } }).catch(() => {})
    await prisma.user.delete({ where: { id } }).catch(() => {})
  }
  await app.close()
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

const MISSING = "c000000000000000000000001"

describe("me notifications bulk + delete", () => {
  it("PATCH /me/notifications/read-all rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "PATCH", url: "/api/v1/me/notifications/read-all" })
    expect(res.statusCode).toBe(401)
  })

  it("PATCH /me/notifications/read-all route exists", async () => {
    const res = await app.inject({ method: "PATCH", url: "/api/v1/me/notifications/read-all" })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })

  it("DELETE /me/notifications/:id rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/me/notifications/${MISSING}` })
    expect(res.statusCode).toBe(401)
  })

  it("DELETE /me/notifications/:id route exists", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/me/notifications/${MISSING}` })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })

  it("PATCH /me/notifications/read-all marks unread only (single-query)", async () => {
    const { id, token } = await createTraveler("plan-readall")
    const { prisma } = await import("@camermove/db")
    await prisma.notification.createMany({
      data: [
        { userId: id, channel: "push", type: "t1", payload: { read: true } },
        { userId: id, channel: "push", type: "t2", payload: { note: "unread" } },
      ],
    })
    const auth = { authorization: `Bearer ${token}` }
    const first = await app.inject({ method: "PATCH", url: "/api/v1/me/notifications/read-all", headers: auth })
    expect(first.statusCode).toBe(200)
    expect(first.json()).toEqual({ marked: 1 })
    const second = await app.inject({ method: "PATCH", url: "/api/v1/me/notifications/read-all", headers: auth })
    expect(second.statusCode).toBe(200)
    expect(second.json()).toEqual({ marked: 0 })
  })

  it("PATCH /me/notifications/read-all empty inbox returns { marked: 0 }", async () => {
    const { token } = await createTraveler("plan-readall-empty")
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/me/notifications/read-all",
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { marked: unknown }
    expect(body).toHaveProperty("marked")
    expect(body.marked).toBe(0)
  })
})

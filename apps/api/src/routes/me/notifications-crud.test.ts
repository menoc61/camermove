import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

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
})

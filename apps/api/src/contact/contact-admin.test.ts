import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

describe("contact back-office", () => {
  it("GET /admin/contact rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/contact" })
    expect(res.statusCode).toBe(401)
  })

  it("GET /admin/contact route exists", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/contact" })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })

  it("GET /admin/contact/export rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/contact/export?format=json" })
    expect(res.statusCode).toBe(401)
  })

  it("GET /admin/contact/export route exists", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/contact/export?format=json" })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})

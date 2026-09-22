import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

describe("newsletter back-office", () => {
  it("GET /admin/newsletter rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/newsletter" })
    expect(res.statusCode).toBe(401)
  })

  it("GET /admin/newsletter route exists", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/newsletter" })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })

  it("DELETE /newsletter removes unknown email with 200 unsubscribed:false", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/v1/newsletter", payload: { email: "nobody@x.cm" } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ unsubscribed: false })
  })
})

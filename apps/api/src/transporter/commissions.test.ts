import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

describe("GET /transporter/commissions", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/transporter/commissions" })
    expect(res.statusCode).toBe(401)
  })

  it("route exists (not Fastify 404 body)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/transporter/commissions" })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})

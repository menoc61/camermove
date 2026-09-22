import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

const MISSING = "c000000000000000000000001"

describe("partner event management", () => {
  it("POST /partner/events rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/partner/events", payload: { name: "x" } })
    expect(res.statusCode).toBe(401)
  })

  it("POST /partner/events route exists", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/partner/events", payload: { name: "x" } })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})

import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

const MISSING = "c000000000000000000000001"

describe("hotel deletes", () => {
  it("DELETE /partner/hotels/:id rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/hotels/${MISSING}` })
    expect(res.statusCode).toBe(401)
  })

  it("DELETE /partner/hotels/:id route exists", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/hotels/${MISSING}` })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })

  it("DELETE room rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/hotels/${MISSING}/rooms/${MISSING}` })
    expect(res.statusCode).toBe(401)
  })

  it("DELETE room route exists", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/hotels/${MISSING}/rooms/${MISSING}` })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})

describe("DELETE /admin/hotels/:id", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/admin/hotels/${MISSING}` })
    expect(res.statusCode).toBe(401)
  })

  it("route exists", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/admin/hotels/${MISSING}` })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})

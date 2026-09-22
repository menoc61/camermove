import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"
import { loadEnv } from "@camermove/config"
import { signTokens } from "../auth/tokens"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

const MISSING = "c000000000000000000000001"

describe("rental deletes", () => {
  it("DELETE /partner/rentals/:id rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/rentals/${MISSING}` })
    expect(res.statusCode).toBe(401)
  })

  it("DELETE /partner/rentals/:id route exists", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/rentals/${MISSING}` })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })

  it("authenticated traveler DELETE missing id returns 404 (NotFound before owner-check)", async () => {
    const { accessToken } = signTokens({ id: "no-such-user", role: "traveler" }, loadEnv())
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/partner/rentals/${MISSING}`,
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toHaveProperty("message", expect.stringContaining("Véhicule introuvable"))
  })
})

describe("DELETE /admin/rentals/:id", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/admin/rentals/${MISSING}` })
    expect(res.statusCode).toBe(401)
  })

  it("route exists", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/admin/rentals/${MISSING}` })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})

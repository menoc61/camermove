import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"
import { loadEnv } from "@camermove/config"
import { signTokens } from "../auth/tokens"

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

describe("PUT /partner/events/:id", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "PUT", url: `/api/v1/partner/events/${MISSING}`, payload: { name: "y" } })
    expect(res.statusCode).toBe(401)
  })

  it("route exists", async () => {
    const res = await app.inject({ method: "PUT", url: `/api/v1/partner/events/${MISSING}`, payload: { name: "y" } })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})

describe("DELETE /partner/events/:id", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/events/${MISSING}` })
    expect(res.statusCode).toBe(401)
  })

  it("route exists", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/events/${MISSING}` })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})

describe("GET /partner/events staff gate", () => {
  it("traveler role returns 403 (staff gate with real role)", async () => {
    const { accessToken } = signTokens({ id: "no-such-user", role: "traveler" }, loadEnv())
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/partner/events",
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toHaveProperty("message", expect.stringContaining("Accès réservé aux partenaires"))
  })
})

describe("DELETE /partner/events/:id guard ordering", () => {
  it("staff role on missing id returns 404 (NotFoundError past the staff gate)", async () => {
    const { accessToken } = signTokens({ id: "no-such-user", role: "transporter_staff" }, loadEnv())
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/partner/events/${MISSING}`,
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toHaveProperty("message", expect.stringContaining("Événement introuvable"))
  })

  it("traveler role on missing id returns 403 (staff gate fires before lookup)", async () => {
    const { accessToken } = signTokens({ id: "no-such-user", role: "traveler" }, loadEnv())
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/partner/events/${MISSING}`,
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toHaveProperty("message", expect.stringContaining("Accès réservé aux partenaires"))
  })
})

describe("POST /partner/events/:id/categories", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "POST", url: `/api/v1/partner/events/${MISSING}/categories`, payload: { name: "VIP", price: 10000, quantity: 50 } })
    expect(res.statusCode).toBe(401)
  })

  it("route exists", async () => {
    const res = await app.inject({ method: "POST", url: `/api/v1/partner/events/${MISSING}/categories`, payload: { name: "VIP", price: 10000, quantity: 50 } })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })

  it("staff token on missing id → 404 (owner lookup path)", async () => {
    const { accessToken } = signTokens({ id: "no-such-user", role: "transporter_staff" }, loadEnv())
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/partner/events/${MISSING}/categories`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: "VIP", price: 10000, quantity: 50 },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toHaveProperty("message", expect.stringContaining("Événement introuvable"))
  })
})

import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"
import { loadEnv } from "@camermove/config"
import { signTokens } from "../auth/tokens"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

const MISSING = "c000000000000000000000001"

// Auth is JWT-claims only (no DB user lookup), so a fake-subject token
// exercises auth + routing + NotFoundError mapping without seeding.
// Full PUT/DELETE happy paths would need transporter + trip + confirmed
// booking + review rows (>30 lines of setup); 404-probes taken instead.

describe("reviews :id routes", () => {
  it("GET missing review returns 404 (not router 404)", async () => {
    const res = await app.inject({ method: "GET", url: `/api/v1/reviews/${MISSING}` })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toHaveProperty("message", expect.stringContaining("Avis introuvable"))
  })

  it("DELETE without token returns 401", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/reviews/${MISSING}` })
    expect(res.statusCode).toBe(401)
  })

  it("PUT without token returns 401", async () => {
    const res = await app.inject({ method: "PUT", url: `/api/v1/reviews/${MISSING}`, payload: { rating: 5 } })
    expect(res.statusCode).toBe(401)
  })

  it("PUT missing review with token returns 404 (NotFoundError, not 401/500)", async () => {
    const { accessToken } = signTokens({ id: "no-such-user", role: "traveler" }, loadEnv())
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/reviews/${MISSING}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { rating: 5 },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toHaveProperty("message", expect.stringContaining("Avis introuvable"))
  })

  it("DELETE missing review with token returns 404 (NotFoundError, not 401/500)", async () => {
    const { accessToken } = signTokens({ id: "no-such-user", role: "traveler" }, loadEnv())
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/reviews/${MISSING}`,
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toHaveProperty("message", expect.stringContaining("Avis introuvable"))
  })
})

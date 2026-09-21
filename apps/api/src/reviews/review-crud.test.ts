import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

const MISSING = "c000000000000000000000001"

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
})

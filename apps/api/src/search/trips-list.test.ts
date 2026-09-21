import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

describe("GET /trips", () => {
  it("returns 200 with a paginated items envelope", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/trips?perPage=5" })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: unknown[]; page: number; meta: { cached: boolean } }
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.page).toBe(1)
    expect(typeof body.meta.cached).toBe("boolean")
  })

  it("rejects perPage over limit with 400", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/trips?perPage=9999" })
    expect(res.statusCode).toBe(400)
  })
})

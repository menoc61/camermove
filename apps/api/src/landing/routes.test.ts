import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { FastifyInstance } from "fastify"

vi.mock("./service.js", () => ({
  getLandingStats: vi.fn(async () => ({
    minPrice: 3500,
    nextDepartureAt: "2026-09-10T08:00:00.000Z",
    hotelsCount: 12,
    rentalsCount: 7,
    agencies: [],
  })),
  getLandingRail: vi.fn(async (type: string) =>
    type === "insurance"
      ? { type, pricing: { basic: 2500 } }
      : { type, items: [] },
  ),
}))

import { buildApp } from "../app.js"

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
})

afterAll(async () => {
  await app?.close()
})

describe("GET /landing/stats", () => {
  it("200 returns {minPrice,nextDepartureAt,hotelsCount,rentalsCount,agencies}", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/landing/stats" })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Record<string, unknown>
    expect(body).toHaveProperty("minPrice")
    expect(body).toHaveProperty("nextDepartureAt")
    expect(body).toHaveProperty("hotelsCount")
    expect(body).toHaveProperty("rentalsCount")
    expect(body).toHaveProperty("agencies")
  })
})

describe("GET /landing/rails", () => {
  it("200 for each valid type", async () => {
    for (const type of ["transport", "hotels", "rentals", "events", "insurance"]) {
      const res = await app.inject({ method: "GET", url: `/api/v1/landing/rails?type=${type}` })
      expect(res.statusCode).toBe(200)
    }
  })

  it("400 on missing type (Zod)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/landing/rails" })
    expect(res.statusCode).toBe(400)
  })

  it("400 on invalid type (Zod)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/landing/rails?type=parcels" })
    expect(res.statusCode).toBe(400)
  })
})

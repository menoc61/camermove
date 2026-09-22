import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

describe("security headers", () => {
  it("sets helmet headers on /health", async () => {
    const res = await app.inject({ method: "GET", url: "/health" })
    expect(res.statusCode).toBe(200)
    expect(res.headers["x-content-type-options"]).toBe("nosniff")
    expect(res.headers["x-frame-options"]).toBeDefined()
    expect(res.headers["strict-transport-security"]).toBeDefined()
  })
})

import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"
import { parseAdminSort } from "./service"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

describe("parseAdminSort", () => {
  it("accepts allowlisted field.dir", () => {
    expect(parseAdminSort("email.asc", ["email", "createdAt"], { createdAt: "desc" })).toEqual({ email: "asc" })
  })

  it("falls back on unknown field", () => {
    expect(parseAdminSort("hacker.desc", ["email"], { createdAt: "desc" })).toEqual({ createdAt: "desc" })
  })
})

describe("GET /admin/users sorting", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/users?sort=email.asc" })
    expect(res.statusCode).toBe(401)
  })

  it("route accepts sort param (not Fastify 404 body)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/users?sort=email.asc" })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})

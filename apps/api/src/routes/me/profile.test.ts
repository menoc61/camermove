import { describe, it, expect } from "vitest"
import { buildApp } from "../../app"
import { loadEnv } from "@camermove/config"
import { signTokens } from "../../auth/tokens"

describe("GET /me/profile", () => {
  it("401 without token; 200 with token; 401 for non-active status", async () => {
    const app = await buildApp()
    const noAuth = await app.inject({ method: "GET", url: "/api/v1/me/profile" })
    expect(noAuth.statusCode).toBe(401)

    const env = loadEnv()
    const { accessToken } = signTokens({ id: "no-such-user", role: "traveler" }, env)
    const ghost = await app.inject({
      method: "GET",
      url: "/api/v1/me/profile",
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(ghost.statusCode).toBe(401)

    const { prisma } = await import("@camermove/db")
    const email = `plan2-profile-${Date.now()}@test.cm`
    const created = await prisma.user.create({
      data: { email, passwordHash: "x", role: "admin" },
    })
    try {
      const { accessToken: real } = signTokens({ id: created.id, role: "admin" }, env)
      const ok = await app.inject({
        method: "GET",
        url: "/api/v1/me/profile",
        headers: { authorization: `Bearer ${real}` },
      })
      expect(ok.statusCode).toBe(200)
      const body = ok.json() as { id: string; email: string; role: string; status: string }
      expect(body.id).toBe(created.id)
      expect(body.role).toBe("admin")
      expect(body.status).toBe("active")
    } finally {
      await prisma.user.delete({ where: { id: created.id } })
    }
    await app.close()
  })
})

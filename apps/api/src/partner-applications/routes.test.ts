import { describe, it, expect } from "vitest"
import { buildApp } from "../app"
import { loadEnv } from "@camermove/config"
import { signTokens } from "../auth/tokens"

describe("partner-application routes auth", () => {
  it("401 without token; accepts valid JWT on /me", async () => {
    const app = await buildApp()
    const noAuth = await app.inject({ method: "POST", url: "/api/v1/partner-applications/presign", payload: {} })
    expect(noAuth.statusCode).toBe(401)

    const env = loadEnv()
    const { accessToken } = signTokens({ id: "routes-test-user", role: "traveler" }, env)
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/partner-applications/me",
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})

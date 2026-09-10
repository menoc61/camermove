import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"
import { prisma } from "@camermove/db"

interface AuthPair {
  accessToken: string
  refreshToken: string
  user: { id: string; email: string; role: string }
}

let app: FastifyInstance
const createdUserIds: string[] = []
const tag = `refresh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// Every request uses a fresh client IP: rate limiting is per-IP per-path, so
// this keeps each request in its own bucket (immune to counters left by
// previous runs, reruns inside the 60s window, or parallel suites).
let ipCounter = 0
function freshIp(): Record<string, string> {
  ipCounter += 1
  const hi = (Math.floor(ipCounter / 250) % 250) + 1
  const lo = (ipCounter % 250) + 1
  return { "x-forwarded-for": `10.220.${hi}.${lo}` }
}

beforeAll(async () => {
  app = await buildApp()
})

afterAll(async () => {
  for (const id of createdUserIds) {
    await prisma.user.delete({ where: { id } }).catch(() => {})
  }
  await app?.close()
})

async function registerPair(email: string): Promise<AuthPair> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: freshIp(),
    payload: { email, password: "S3cret-pass!" },
  })
  expect(res.statusCode).toBe(201)
  const body = res.json() as AuthPair
  expect(body.accessToken).toBeTruthy()
  expect(body.refreshToken).toBeTruthy()
  createdUserIds.push(body.user.id)
  return body
}

function postRefresh(refreshToken: unknown) {
  return app.inject({
    method: "POST",
    url: "/api/v1/auth/refresh",
    headers: freshIp(),
    payload: refreshToken === undefined ? undefined : { refreshToken },
  })
}

describe("POST /auth/refresh rotation", () => {
  it("issues a new pair on success (old jti consumed)", async () => {
    const pair1 = await registerPair(`${tag}-a@test.cm`)

    const res = await postRefresh(pair1.refreshToken)
    expect(res.statusCode).toBe(200)
    const pair2 = res.json() as AuthPair
    expect(pair2.user.id).toBe(pair1.user.id)
    expect(pair2.accessToken).toBeTruthy()
    expect(pair2.refreshToken).toBeTruthy()
    expect(pair2.refreshToken).not.toBe(pair1.refreshToken)
  })

  it("detects reuse: replaying a rotated token 401s and revokes the family", async () => {
    const pair1 = await registerPair(`${tag}-b@test.cm`)

    const rotated = await postRefresh(pair1.refreshToken)
    expect(rotated.statusCode).toBe(200)
    const pair2 = rotated.json() as AuthPair

    // Replay the already-rotated token -> theft detected
    const replay = await postRefresh(pair1.refreshToken)
    expect(replay.statusCode).toBe(401)

    // Whole family revoked: the token issued by the legitimate rotation is dead too
    const afterRevoke = await postRefresh(pair2.refreshToken)
    expect(afterRevoke.statusCode).toBe(401)
  })

  it("logout invalidates the refresh token", async () => {
    const pair = await registerPair(`${tag}-c@test.cm`)

    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { ...freshIp(), authorization: `Bearer ${pair.accessToken}` },
      payload: { refreshToken: pair.refreshToken },
    })
    expect(logout.statusCode).toBe(200)
    expect(logout.json()).toEqual({ loggedOut: true })

    const res = await postRefresh(pair.refreshToken)
    expect(res.statusCode).toBe(401)
    // Denylist persists: still 401 on retry
    expect((await postRefresh(pair.refreshToken)).statusCode).toBe(401)
  })

  it("rejects missing/invalid tokens with 401", async () => {
    expect((await postRefresh(undefined)).statusCode).toBe(401)
    expect((await postRefresh({})).statusCode).toBe(401)
    expect((await postRefresh("not-a-jwt")).statusCode).toBe(401)
    expect((await postRefresh("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.invalid")).statusCode).toBe(401)
  })
})

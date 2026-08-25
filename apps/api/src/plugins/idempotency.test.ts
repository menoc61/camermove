import { describe, it, expect, afterAll } from "vitest"
import { randomUUID } from "node:crypto"
import Fastify, { type FastifyInstance } from "fastify"
import { idempotencyPlugin } from "./idempotency"
import { closeRedis, getRedis } from "../lib/redis"

const calls = { count: 0 }
const runId = randomUUID()
const url = `/things/${runId}`

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify()
  await app.register(idempotencyPlugin)
  app.post(url, async (_req, reply) => {
    calls.count += 1
    return reply.code(201).send({ ok: true, execution: calls.count })
  })
  return app
}

// The plugin persists responses fire-and-forget; wait until the write lands instead of guessing a delay.
async function waitForIdempotencyCache(cacheKey: string): Promise<void> {
  for (let i = 0; i < 25; i += 1) {
    const raw = await getRedis().get(cacheKey)
    if (raw !== null) return
    await new Promise((r) => setTimeout(r, 80))
  }
  throw new Error("idempotency cache write did not land within 2s")
}

describe("idempotencyPlugin replay", () => {
  let app: FastifyInstance

  afterAll(async () => {
    await app?.close()
    await getRedis().del(`idemp:${url}:gate-key-1`, `idemp:${url}:gate-key-2`).catch(() => {})
    await closeRedis()
  })

  it("replays the same status+body without re-executing the handler", async () => {
    app = await buildApp()
    const headers = { "idempotency-key": "gate-key-1" }
    const first = await app.inject({ method: "POST", url, headers })
    expect(first.statusCode).toBe(201)
    expect(first.json()).toEqual({ ok: true, execution: 1 })

    await waitForIdempotencyCache(`idemp:${url}:gate-key-1`)

    const replay = await app.inject({ method: "POST", url, headers })
    expect(replay.statusCode).toBe(201)
    expect(replay.json()).toEqual(first.json())
    expect(calls.count).toBe(1)
  }, 20000)

  it("executes again when the key differs or is absent", async () => {
    const otherKey = await app.inject({
      method: "POST",
      url,
      headers: { "idempotency-key": "gate-key-2" },
    })
    expect(otherKey.statusCode).toBe(201)
    expect(otherKey.json()).toEqual({ ok: true, execution: 2 })

    const noKeyA = await app.inject({ method: "POST", url })
    const noKeyB = await app.inject({ method: "POST", url })
    expect(noKeyA.statusCode).toBe(201)
    expect(noKeyB.json()).toEqual({ ok: true, execution: 4 })
    expect(calls.count).toBe(4)
  }, 20000)
})

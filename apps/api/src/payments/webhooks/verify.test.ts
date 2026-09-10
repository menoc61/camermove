import { describe, it, expect, vi, beforeAll, afterAll } from "vitest"
import crypto from "node:crypto"
import type { FastifyInstance } from "fastify"
import { loadEnv } from "@camermove/config"
import { buildApp } from "../../app"
import { verifyNotchSignature } from "./verify"

// Kafka stubbed: no broker traffic in tests (unit + inject stay offline).
// Redis (dedup) uses the live docker service like the other integration
// tests. Signature rejects return before dedup/enqueue, so they assert
// "no state change" without touching infra at all.
vi.mock("@camermove/events", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>
  return {
    ...(orig as object),
    createKafkaClient: () => ({
      producer: () => ({
        connect: vi.fn().mockResolvedValue(undefined),
        send: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  }
})

function signNotch(rawBody: string, key: string): string {
  return crypto.createHmac("sha256", key).update(rawBody).digest("hex")
}

function uniqueEventId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function eventBody(deliveryId: string): string {
  return JSON.stringify({
    id: deliveryId,
    type: "payment.success",
    data: { id: "tr_test_123", reference: `CM-TEST-${deliveryId}`, amount: 5000 },
  })
}

describe("verifyNotchSignature (unit)", () => {
  const key = "unit-test-hash-key"

  it("accepts a valid HMAC-SHA256 hex signature", () => {
    const raw = JSON.stringify({ id: "evt_1", type: "payment.success" })
    expect(verifyNotchSignature(raw, signNotch(raw, key), key)).toBe(true)
  })

  it("rejects a tampered signature", () => {
    const raw = JSON.stringify({ id: "evt_1", type: "payment.success" })
    const valid = signNotch(raw, key)
    const tampered = valid.slice(0, -1) + (valid.endsWith("0") ? "1" : "0")
    expect(verifyNotchSignature(raw, tampered, key)).toBe(false)
  })

  it("rejects a body that was modified after signing", () => {
    const raw = JSON.stringify({ id: "evt_1", type: "payment.success" })
    const sig = signNotch(raw, key)
    expect(verifyNotchSignature(raw + " ", sig, key)).toBe(false)
  })

  it("rejects missing/empty inputs and a wrong key", () => {
    const raw = JSON.stringify({ id: "evt_1" })
    const sig = signNotch(raw, key)
    expect(verifyNotchSignature(raw, "", key)).toBe(false)
    expect(verifyNotchSignature("", sig, key)).toBe(false)
    expect(verifyNotchSignature(raw, sig, "wrong-key")).toBe(false)
    expect(verifyNotchSignature(raw, "not-hex!!", key)).toBe(false)
  })
})

describe("POST /api/v1/webhooks/notchpay (inject, no network)", () => {
  let app: FastifyInstance
  let hashKey: string

  beforeAll(async () => {
    app = await buildApp()
    hashKey = loadEnv().NOTCHPAY_HASH_KEY
  })

  afterAll(async () => {
    await app.close()
  })

  it("200 on valid X-Notch-Signature (HMAC accept path)", async () => {
    const raw = eventBody(uniqueEventId("evt_ok"))
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks/notchpay",
      headers: { "content-type": "application/json", "x-notch-signature": signNotch(raw, hashKey) },
      payload: raw,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe("received")
  })

  it("401 when the signature header is missing", async () => {
    const raw = eventBody(uniqueEventId("evt_nosig"))
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks/notchpay",
      headers: { "content-type": "application/json" },
      payload: raw,
    })
    expect(res.statusCode).toBe(401)
  })

  it("403 on a tampered signature, with no state change", async () => {
    const deliveryId = uniqueEventId("evt_tampered")
    const raw = eventBody(deliveryId)
    const valid = signNotch(raw, hashKey)
    const tampered = valid.slice(0, -1) + (valid.endsWith("0") ? "1" : "0")

    const rejected = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks/notchpay",
      headers: { "content-type": "application/json", "x-notch-signature": tampered },
      payload: raw,
    })
    expect(rejected.statusCode).toBe(403)

    // No state change: the rejected delivery left no dedup trace, so a
    // retry with the now-valid signature is "received", not "duplicate".
    const retry = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks/notchpay",
      headers: { "content-type": "application/json", "x-notch-signature": valid },
      payload: raw,
    })
    expect(retry.statusCode).toBe(200)
    expect(retry.json().status).toBe("received")
  })
})

/**
 * NotchPay webhook receipt — verify, dedup, enqueue, 200 fast.
 * CONTRACT: this handler does NOT call provider verify API or mutate Booking/Payment/Commission.
 * That happens asynchronously in the worker (reconciliation.ts) which calls verifyPayment.
 * This keeps p99 <100ms and avoids retry storms (T-03-17).
 * Never trust amount from notify payload alone — worker double-checks via provider.
 */
import type { FastifyInstance } from "fastify"
import { loadEnv } from "@camermove/config"
import { verifyNotchSignature } from "./verify.js"
import { getRedis } from "../../lib/redis.js"
import { EVENT_TOPICS } from "@camermove/events"

const memoryDedup = new Map<string, number>()
const SEVEN_DAYS = 7 * 24 * 3600

export async function notchpayWebhookRoutes(app: FastifyInstance) {
  // HMAC is auth — no requireAuth. Skip rate-limit burst so provider retries are not 429'd (T-03-20 boundary).
  app.post(
    "/webhooks/notchpay",
    { config: { rateLimit: false } },
    async (req, reply) => {
      // rawBody captured by rawBodyPlugin (global). Must be raw JSON string, fail 400 if missing.
      const rawBody = (req as unknown as { rawBody?: string }).rawBody
      if (typeof rawBody !== "string" || rawBody.length === 0) {
        return reply.code(400).send({ error: "rawBody required — check rawBody plugin registration" })
      }

      const sig = req.headers["x-notch-signature"] as string | undefined
      if (!sig) {
        return reply.code(401).send({ error: "missing signature" })
      }

      let hashKey: string
      try {
        hashKey = loadEnv().NOTCHPAY_HASH_KEY
      } catch {
        req.log.error("NOTCHPAY_HASH_KEY not configured")
        return reply.code(503).send({ error: "notchpay not configured" })
      }

      if (!verifyNotchSignature(rawBody, sig, hashKey)) {
        req.log.warn({ sigLen: sig.length }, "notchpay webhook signature invalid")
        return reply.code(403).send({ error: "invalid signature" })
      }

      let event: { id: string; type: string; data: { id: string; reference: string; amount?: number } }
      try {
        event = JSON.parse(rawBody) as typeof event
      } catch {
        return reply.code(400).send({ error: "invalid JSON" })
      }

      if (!event?.id || !event?.data?.reference) {
        return reply.code(400).send({ error: "missing id or reference" })
      }

      const deliveryId = event.id // evt_xxx globally unique (T-03-13)

      // Atomic dedup: Redis SET NX 7d — first line after verify (anti-pattern check-then-insert avoided)
      let isDuplicate = false
      try {
        const redis = getRedis()
        const res = await redis.set(`webhook:processed:${deliveryId}`, "1", "EX", SEVEN_DAYS, "NX")
        if (res !== "OK") isDuplicate = true
      } catch {
        // Fallback to memory if Redis unavailable
        if (memoryDedup.has(deliveryId)) {
          isDuplicate = true
        } else {
          memoryDedup.set(deliveryId, Date.now() + SEVEN_DAYS * 1000)
          // prune expired entries opportunistically
          if (memoryDedup.size > 10000) {
            const now = Date.now()
            for (const [k, exp] of memoryDedup.entries()) if (exp < now) memoryDedup.delete(k)
          }
        }
      }

      if (isDuplicate) {
        req.log.info({ deliveryId }, "webhook duplicate, ack 200")
        return reply.code(200).send({ status: "duplicate" })
      }

      // Enqueue to Kafka payment.webhook.received — canonical path
      const domainEvent = {
        id: deliveryId,
        type: "payment.webhook.received" as const,
        ts: new Date().toISOString(),
        aggregateId: event.data.reference,
        data: event,
      }

      try {
        const { createKafkaClient } = await import("@camermove/events")
        const env = loadEnv()
        const kafka = createKafkaClient(env as never)
        const producer = kafka.producer({ idempotent: true })
        await producer.connect().catch(() => {})
        await producer.send({
          topic: EVENT_TOPICS.paymentWebhookReceived,
          messages: [{ key: domainEvent.aggregateId, value: JSON.stringify(domainEvent) }],
        })
        await producer.disconnect().catch(() => {})
      } catch (err) {
        // Fallback to Redis list if Kafka not available; keep dedup key so provider retries (500) will re-deliver
        req.log.warn({ err, deliveryId }, "kafka publish failed, fallback to redis queue")
        try {
          const redis = getRedis()
          await redis.lpush("payment-webhooks", JSON.stringify(domainEvent))
        } catch {
          // Enqueue failed — let provider retry: do NOT delete NX key, return 500 so provider retries (per threat T-03-17)
          return reply.code(500).send({ error: "enqueue failed, retry" })
        }
      }

      const meta = (req as unknown as { meta?: Record<string, unknown> }).meta
      req.log.info(
        { deliveryId, type: event.type, ref: event.data.reference, ...meta },
        "webhook enqueued",
      )

      return reply.code(200).send({ status: "received" })
    },
  )
}

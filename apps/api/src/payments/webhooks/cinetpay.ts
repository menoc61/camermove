/**
 * CinetPay webhook receipt — x-token HMAC + form parse + dedup + enqueue.
 * CONTRACT: route does NOT call POST /v2/payment/check — that happens in worker (reconciliation.ts).
 * Never trust cpm_amount from notify alone (T-03-15). Worker verifies code 00 + ACCEPTED + amount===booking.totalAmount.
 */
import type { FastifyInstance } from "fastify"
import { loadEnv } from "@camermove/config"
import { verifyCinetToken } from "./verify.js"
import { getRedis } from "../../lib/redis.js"
import { EVENT_TOPICS } from "@camermove/events"
import crypto from "node:crypto"

const memoryDedup = new Map<string, number>()
const SEVEN_DAYS = 7 * 24 * 3600

export async function cinetpayWebhookRoutes(app: FastifyInstance) {
  app.post(
    "/webhooks/cinetpay",
    { config: { rateLimit: false } },
    async (req, reply) => {
      // rawBody captured by rawBodyPlugin — for form-encoded this is "cpm_site_id=...&cpm_trans_id=..."
      const rawForm = (req as unknown as { rawBody?: string }).rawBody
      if (typeof rawForm !== "string" || rawForm.length === 0) {
        return reply.code(400).send({ error: "rawBody required — check rawBody plugin registration" })
      }

      // Parse form (keep rawForm for debug)
      const parsed = Object.fromEntries(new URLSearchParams(rawForm).entries()) as Record<string, string>

      const xToken = (req.headers["x-token"] as string | undefined) ?? (req.headers["x_token"] as string | undefined)
      if (!xToken) {
        return reply.code(401).send({ error: "missing x-token" })
      }

      let secret: string | undefined
      try {
        secret = loadEnv().CINETPAY_SECRET_KEY
      } catch {
        secret = undefined
      }
      if (!secret) {
        req.log.warn("CINETPAY_SECRET_KEY not configured")
        return reply.code(503).send({ error: "cinetpay not configured" })
      }

      // Verify via isolated helper (does 15-field concat + fallback Object.values join)
      let ok = verifyCinetToken(parsed, xToken, secret)
      // Explicit fallback for docs ambiguity per plan — helper already covers it but double-check with raw fallback
      if (!ok) {
        const fallbackData = Object.values(parsed).join("")
        const fallbackExpected = crypto.createHmac("sha256", secret).update(fallbackData).digest("hex")
        try {
          ok = crypto.timingSafeEqual(Buffer.from(fallbackExpected, "hex"), Buffer.from(xToken, "hex"))
        } catch {
          ok = false
        }
      }

      if (!ok) {
        req.log.warn({ xTokenLen: xToken.length }, "cinetpay webhook x-token invalid")
        return reply.code(403).send({ error: "invalid x-token" })
      }

      if (!parsed.cpm_trans_id || !parsed.cpm_trans_date) {
        return reply.code(400).send({ error: "missing cpm_trans_id or cpm_trans_date" })
      }

      const deliveryId = `cinetpay:${parsed.cpm_trans_id}:${parsed.cpm_trans_date}`

      let isDuplicate = false
      try {
        const redis = getRedis()
        const res = await redis.set(`webhook:processed:${deliveryId}`, "1", "EX", SEVEN_DAYS, "NX")
        if (res !== "OK") isDuplicate = true
      } catch {
        if (memoryDedup.has(deliveryId)) isDuplicate = true
        else {
          memoryDedup.set(deliveryId, Date.now() + SEVEN_DAYS * 1000)
          if (memoryDedup.size > 10000) {
            const now = Date.now()
            for (const [k, exp] of memoryDedup.entries()) if (exp < now) memoryDedup.delete(k)
          }
        }
      }

      if (isDuplicate) {
        req.log.info({ deliveryId }, "cinetpay webhook duplicate, ack 200")
        return reply.code(200).send({ status: "duplicate" })
      }

      const domainEvent = {
        id: deliveryId,
        type: "payment.webhook.received" as const,
        ts: new Date().toISOString(),
        aggregateId: parsed.cpm_trans_id,
        data: parsed,
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
        req.log.warn({ err, deliveryId }, "kafka publish failed, fallback to redis queue")
        try {
          const redis = getRedis()
          await redis.lpush("payment-webhooks", JSON.stringify(domainEvent))
        } catch {
          return reply.code(500).send({ error: "enqueue failed, retry" })
        }
      }

      const meta = (req as unknown as { meta?: Record<string, unknown> }).meta
      req.log.info(
        { deliveryId, transId: parsed.cpm_trans_id, ...meta },
        "cinetpay webhook enqueued",
      )

      return reply.code(200).send({ status: "received" })
    },
  )
}

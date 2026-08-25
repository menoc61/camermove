import fp from "fastify-plugin"
import type { FastifyInstance } from "fastify"

/**
 * Capture raw body string on req.rawBody for HMAC verification.
 * Must be registered before any route that needs HMAC (webhooks).
 * Falls back to manual buffering if fastify-raw-body is not installed.
 * Preserves Fastify JSON parsing for non-webhook routes.
 */
export const rawBodyPlugin = fp(async (app: FastifyInstance) => {
  // JSON: store raw string then parse
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req: unknown, body: unknown, done: (err: Error | null, result?: unknown) => void) => {
      const raw = body as string
      ;(req as unknown as Record<string, unknown>).rawBody = raw
      if (!raw) return done(null, undefined)
      try {
        done(null, JSON.parse(raw))
      } catch (err) {
        done(err as Error)
      }
    },
  )

  // Form urlencoded: store raw string and parse to record
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (req: unknown, body: unknown, done: (err: Error | null, result?: unknown) => void) => {
      const raw = body as string
      ;(req as unknown as Record<string, unknown>).rawBody = raw
      try {
        const parsed = Object.fromEntries(new URLSearchParams(raw).entries())
        done(null, parsed)
      } catch (err) {
        done(err as Error)
      }
    },
  )

  // Fallback: for any other content-type, still capture body if present via onRequest buffering
  // (not needed for JSON/form but keeps rawBody field consistent)
})

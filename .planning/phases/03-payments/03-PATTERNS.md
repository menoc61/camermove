# Phase 3: Payments — Pattern Map

**Mapped:** 2026-08-25
**Files analyzed:** 17 (14 new + 3 modified)
**Analogs found:** 11 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/api/src/payments/schema.ts` | validation/config | request-response | `apps/api/src/bookings/schema.ts` | exact |
| `apps/api/src/payments/service.ts` | service | CRUD + ACID transaction + event-driven | `apps/api/src/bookings/service.ts` | exact |
| `apps/api/src/payments/repository.ts` | repository | CRUD | `apps/api/src/bookings/repository.ts` | exact |
| `apps/api/src/payments/commission.ts` | utility/service | transform | `apps/api/src/bookings/cancellation.ts` | role-match |
| `apps/api/src/payments/routes.ts` | route/controller | request-response | `apps/api/src/bookings/routes.ts` | exact |
| `apps/api/src/payments/webhooks/notchpay.ts` | route/middleware | event-driven (webhook receipt) | `apps/api/src/auth/routes.ts` (google callback + HMAC verify) | partial |
| `apps/api/src/payments/webhooks/cinetpay.ts` | route/middleware | event-driven (webhook receipt) | `apps/api/src/auth/routes.ts` | partial |
| `apps/api/src/payments/webhooks/verify.ts` | utility | transform (crypto) | `apps/api/src/auth/password.ts` + RESEARCH code examples | partial |
| `apps/api/src/payments/providers/types.ts` | provider/interface | request-response | `packages/events/src/types.ts` + `packages/events/src/topics.ts` | partial |
| `apps/api/src/payments/providers/notchpay.adapter.ts` | provider/service | request-response | `apps/api/src/auth/social.ts` (GoogleProvider adapter) | role-match |
| `apps/api/src/payments/providers/cinetpay.adapter.ts` | provider/service | request-response | `apps/api/src/auth/social.ts` | role-match |
| `apps/api/src/payments/providers/index.ts` | provider/registry | request-response | `apps/api/src/auth/social.ts` + `apps/api/src/payments/providers/types.ts` | partial |
| `apps/api/src/payments/jobs/reconciliation.ts` | job/worker | batch + event-driven | `apps/api/src/bookings/service.ts` (`expireHolds`) + `apps/worker/src/index.ts` | role-match |
| `apps/api/src/payments/jobs/refund.ts` | job/service | request-response + ACID | `apps/api/src/bookings/service.ts` (`cancelBooking`) | role-match |
| `packages/shared/src/money.ts` (new) | utility/shared | transform | `apps/api/src/bookings/cancellation.ts` lines 121-124 | partial |
| `packages/events/src/topics.ts` (modify) | config/events | pub-sub | existing file itself | exact |
| `packages/config/src/env.ts` (modify) | config | — | existing file itself | exact |
| `packages/db/prisma/schema.prisma` (modify) | model/migration | — | existing file itself | exact |

## Pattern Assignments

### `apps/api/src/payments/schema.ts` (validation, request-response)

**Analog:** `apps/api/src/bookings/schema.ts` (lines 1-11) + `apps/api/src/search/schema.ts` for query enums

**Imports pattern** (lines 1-2):
```typescript
import { z } from "zod"
export const CreateBookingBody = z.object({
  tripId: z.string().cuid(),
  seatCount: z.coerce.number().int().min(1).max(10),
  passengers: z.array(z.object({ fullName: z.string().min(1).max(100), phone: z.string().optional() })).min(1),
})
```

**Core Zod pattern to copy:**
- Every body/query/params is a Zod object exported as `const X = z.object({...})` + `export type X = z.infer<typeof X>`
- Use `z.string().cuid()` for IDs, `z.coerce.number().int().min/max` for amounts, `z.enum([...])` for provider/method
- For `CreatePaymentBody`: `{ bookingId: z.string().cuid(), provider: z.enum(["notchpay","cinetpay"]), method: z.enum(["mobile_money","card","bank_transfer"]).optional(), phone: z.string().optional(), email: z.string().email().optional() }`
- For `PaymentListQuery`: reuse `PaginationSchema + FilterSchema + dateFrom/dateTo` from `apps/api/src/lib/query.ts` lines 14-35
- For webhook schemas: `NotchPayWebhook = z.object({ id: z.string(), type: z.string(), data: z.object({ id: z.string(), reference: z.string() }) })` and `CinetPayNotify = z.record(z.string(), z.string())` (form-encoded, validate after parse)

**Validation usage** (from `apps/api/src/bookings/routes.ts` lines 12, 21, 38):
```typescript
const body = CreateBookingBody.parse(req.body)
const { id } = BookingParams.parse(req.params)
const body = BulkActionSchema.parse(req.body)
```

---

### `apps/api/src/payments/service.ts` (service, CRUD + ACID + event-driven)

**Analog:** `apps/api/src/bookings/service.ts` (lines 1-120) + `packages/db/src/repositories/seat.repository.ts` (lines 8-43)

**Imports pattern** (lines 1-4):
```typescript
import { prisma } from "@camermove/db"
import { atomicHoldSeats, atomicReleaseHeldSeats, atomicConfirmBookedSeats } from "@camermove/db"
import { ConflictError, NotFoundError } from "@camermove/config"
import { randomUUID } from "node:crypto"
```

**Core service pattern — create with pre-check + atomic side effect + try/catch compensating** (lines 10-41):
```typescript
export async function createBooking(input: { tripId: string; userId: string; seatCount: number; passengers: Array<{ fullName: string; phone?: string }> }) {
  if (input.passengers.length !== input.seatCount) throw new ConflictError("Le nombre de passagers doit correspondre au nombre de places")
  const trip = await prisma.trip.findUnique({ where: { id: input.tripId }, include: { seatAvailability: true } })
  if (!trip) throw new NotFoundError("Trajet introuvable")
  if (trip.status !== "active") throw new ConflictError("Trajet non disponible")
  await atomicHoldSeats(input.tripId, input.seatCount)
  try {
    const reference = generateReference()
    const totalAmount = trip.price * input.seatCount
    const holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000)
    const booking = await prisma.booking.create({ data: { reference, tripId: input.tripId, userId: input.userId, seatCount: input.seatCount, totalAmount, status: "pending_payment", holdExpiresAt, passengers: { create: input.passengers.map((p) => ({ fullName: p.fullName, phone: p.phone })) } }, include: { passengers: true, trip: true } })
    return booking
  } catch (e) {
    await atomicReleaseHeldSeats(input.tripId, input.seatCount).catch(() => {})
    throw e
  }
}
```

**Copy for payments:**
- `createPayment({ bookingId, userId, providerName, phone/email })` must:
  1. `findBookingById` + check `booking.userId === userId` (ownership) else `ForbiddenError`
  2. Check `booking.status === "pending_payment"` else `ConflictError("Réservation non payable")`
  3. Check no existing `Payment where bookingId + status IN (pending,processing)` — reuse `one-pending-per-booking` guard via `prisma.payment.findFirst`
  4. Compute `amount = booking.totalAmount` (never trust client amount) + validate `amount %5===0` for CinetPay + `currency==="XAF"`
  5. Call `getProvider(providerName).createPayment(input)` to get `providerRef + authorizationUrl`
  6. Create `prisma.payment.create({ bookingId, provider, providerRef, amount, status:"pending", webhookPayload: rawResponse })`
  7. Extend `holdExpiresAt` if needed using `AppSettings.holdExpiryMinutes` pattern (see commission.ts / admin/settings.ts)
  8. `req.log.info({ ...meta, bookingId, provider, amount }, "payment.create")` + `prisma.auditLog.create({ actorId:userId, action:"payment.create", entityType:"Payment", entityId: payment.id, metadata: { provider, amount } })`

**Transactional state transition pattern** (from `apps/api/src/bookings/service.ts` lines 47-54 for `expireHolds` + lines 91-96 for cancel):
```typescript
await prisma.$transaction(async (tx: any) => {
  await tx.booking.update({ where: { id: b.id }, data: { status: "expired" } })
  const sa = await tx.seatAvailability.findUnique({ where: { tripId: b.tripId } })
  if (sa && sa.seatsHeld >= b.seatCount) {
    await tx.seatAvailability.update({ where: { tripId: b.tripId }, data: { seatsAvailable: { increment: b.seatCount }, seatsHeld: { decrement: b.seatCount } } })
  }
})
```

For `confirmPaymentPaymentSuccess(reference, event)` copy RESEARCH pattern in `03-RESEARCH.md` lines 399-433 but using this tx shape:
- Inside `prisma.$transaction` with `FOR UPDATE` via `tx.$queryRaw` if contending with `expireHolds` (see seat.repository.ts lines 10-14)
- Guard: `if (payment.status === "success") return` (idempotent)
- Guard: `if (["failed","refunded"].includes(payment.status)) return`
- Verify via `provider.verifyPayment(payment.providerRef!)` for CinetPay mandatory
- Update `payment.status="success"`, `booking.status="confirmed"`, `seatAvailability: seatsHeld decrement + seatsBooked increment`, `commission.create`, `auditLog.create`

**Error handling pattern:** Throw `BadRequestError`, `ConflictError`, `NotFoundError`, `ForbiddenError` from `@camermove/config` — caught by `app.setErrorHandler` in `apps/api/src/app.ts` lines 27-36:
```typescript
app.setErrorHandler((err, req, reply) => {
  if (err instanceof AppError) {
    return reply.code(err.status).send({ error: err.code, message: err.message })
  }
  if (err && typeof err === "object" && "issues" in (err as Record<string, unknown>)) {
    return reply.code(400).send({ error: "VALIDATION", message: (err as Error).message })
  }
  req.log.error(err)
  return reply.code(500).send({ error: "INTERNAL", message: "Erreur interne" })
})
```

---

### `apps/api/src/payments/repository.ts` (repository, CRUD)

**Analog:** `apps/api/src/bookings/repository.ts` (lines 1-33) + `packages/db/src/repositories/user.repository.ts` (lines 1-73)

**Imports pattern:**
```typescript
import { prisma } from "@camermove/db"
```

**Core repository pattern** (from `apps/api/src/bookings/repository.ts` lines 3-33):
```typescript
export async function findBookingById(id: string) {
  return prisma.booking.findUnique({ where: { id }, include: { passengers: true, trip: true } })
}
export async function findExpiredHolds() {
  return prisma.booking.findMany({ where: { status: "pending_payment", holdExpiresAt: { lt: new Date() } } })
}
export async function createBookingRecord(data: { reference: string; tripId: string; userId: string; seatCount: number; totalAmount: number; holdExpiresAt: Date; passengers: Array<{ fullName: string; phone?: string }> }) {
  return prisma.booking.create({ data: { reference: data.reference, tripId: data.tripId, userId: data.userId, seatCount: data.seatCount, totalAmount: data.totalAmount, status: "pending_payment", holdExpiresAt: data.holdExpiresAt, passengers: { create: data.passengers } }, include: { passengers: true, trip: true } })
}
```

**Copy for payments repository:**
- `findPaymentById(id)`, `findPaymentByProviderRef(providerRef)`, `findPaymentByBookingId(bookingId)`, `findPendingPaymentsOlderThan(minutes)`, `listPayments(where, pagination)`
- Use `prisma.payment.findUnique/findMany` with `include: { booking: { include: { trip: true } } }` for commission needs
- Use `prisma.payment.update` / `create` thin wrappers — no business logic, just data access
- Follow `packages/db/src/index.ts` lines 1-5 re-export pattern: central `packages/db` is single DA layer, but payments repo lives in `apps/api/src/payments/repository.ts` per modular monorepo §4 (like bookings)

---

### `apps/api/src/payments/commission.ts` (utility/service, transform)

**Analog:** `apps/api/src/bookings/cancellation.ts` (lines 1-125) for tier/policy logic + `apps/api/src/admin/settings.ts` (lines 18-42) for AppSettings read

**Imports pattern (from cancellation.ts lines 1-32):**
```typescript
import { prisma } from "@camermove/db"
export type CancelActor = "traveler" | "transporter" | "admin" | "super_admin" | "system"
export const DEFAULT_TIERS: CancellationTier[] = [...]
export async function getCancellationTiers(): Promise<CancellationTier[]> {
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: "global" } })
    const flags = settings?.featureFlags as Record<string, unknown> | null
    const tiers = (flags?.cancellationTiers as CancellationTier[] | undefined)
    if (Array.isArray(tiers) && tiers.length > 0) return tiers
  } catch {}
  return DEFAULT_TIERS
}
```

**AppSettings cached read pattern (from admin/settings.ts lines 18-26 + RESEARCH commission.ts example):**
```typescript
// apps/api/src/admin/settings.ts — read-or-create singleton
let settings = await prisma.appSettings.findUnique({ where: { id: "global" } })
if (!settings) { settings = await prisma.appSettings.create({ data: { id: "global" } }) }

// For payments commission — copy getCancellationTiers caching idea + add 30s Redis cache via getCached/setCached
export async function computeCommission(tx: PrismaTx, grossAmount: number, transporterId: string) {
  const settings = await getAppSettingsCached(tx) // cacheKey("appsettings:global", {}) + 30s TTL
  const globalPct = Number(settings.commissionPercent)
  const overrides = (settings.featureFlags as any)?.transporterCommissions as Record<string, number> | undefined
  const pct = overrides?.[transporterId] ?? globalPct
  return calcCommission(grossAmount, pct) // from packages/shared/src/money.ts
}
```

**Money math pattern (from cancellation.ts lines 121-122 + RESEARCH lines 442-445):**
```typescript
const refundAmount = Math.round((input.booking.totalAmount * tier.refundPercent) / 100)
const feeAmount = Math.round((input.booking.totalAmount * tier.feePercent) / 100)
// For commission:
export function calcCommission(gross: number, percent: number) {
  const commissionAmount = Math.round((gross * percent) / 100)
  const netAmount = gross - commissionAmount
  return { commissionAmount, netAmount, percentApplied: percent }
}
```
Always `Math.round`, never floating `*0.1`, integer XAF.

---

### `apps/api/src/payments/routes.ts` (route/controller, request-response)

**Analog:** `apps/api/src/bookings/routes.ts` (lines 1-67) — exact role + data flow match

**Imports pattern** (lines 1-6):
```typescript
import type { FastifyInstance } from "fastify"
import { CreateBookingBody, BookingParams } from "./schema"
import { createBooking, cancelBooking } from "./service"
import { BulkActionSchema } from "../lib/query"
import { loadEnv } from "@camermove/config"
import { parseExportQuery, sendExport } from "../lib/export"
```

**Core route patterns to copy:**

**POST create with auth + metadata + 201** (lines 11-18):
```typescript
app.post("/bookings", { preHandler: app.requireAuth() }, async (req, reply) => {
  const body = CreateBookingBody.parse(req.body)
  const user = (req as unknown as { user: { id: string } }).user
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta
  req.log.info({ ...meta, tripId: body.tripId, seatCount: body.seatCount, passengerCount: body.passengers.length, userId: user.id }, "booking.create")
  const booking = await createBooking({ tripId: body.tripId, userId: user.id, seatCount: body.seatCount, passengers: body.passengers })
  return reply.code(201).send({ booking, totalAmount: booking.totalAmount, holdExpiresAt: booking.holdExpiresAt })
})
```

For payments:
```typescript
app.post("/payments", { preHandler: app.requireAuth() }, async (req, reply) => {
  const body = CreatePaymentBody.parse(req.body)
  const user = (req as unknown as { user: { id: string } }).user
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta
  req.log.info({ ...meta, bookingId: body.bookingId, provider: body.provider, userId: user.id }, "payment.create")
  const result = await createPayment({ bookingId: body.bookingId, userId: user.id, provider: body.provider, phone: body.phone, email: body.email, meta })
  return reply.code(201).send({ payment: result.payment, authorizationUrl: result.authorizationUrl })
})
```

**GET by id with auth + NotFoundError** (lines 20-29):
```typescript
app.get("/bookings/:id", { preHandler: app.requireAuth() }, async (req) => {
  const { id } = BookingParams.parse(req.params)
  const { prisma } = await import("@camermove/db")
  const booking = await prisma.booking.findUnique({ where: { id }, include: { passengers: true, trip: true } })
  if (!booking) { const { NotFoundError } = await import("@camermove/config"); throw new NotFoundError("Réservation introuvable") }
  return booking
})
```

For `GET /payments/:id` — check ownership: `if (payment.booking.userId !== user.id && user.role !== "admin" ...) throw ForbiddenError`

**GET export with dateFrom/dateTo + RBAC + SEARCH_MAX_LIMIT** (lines 50-66):
```typescript
app.get("/bookings/export", { preHandler: app.requireAuth() }, async (req, reply) => {
  const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
  const user = (req as unknown as { user: { id: string } }).user
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta
  req.log.info({ ...meta, userId: user.id, dateFrom, dateTo, format }, "bookings.export")
  const { prisma } = await import("@camermove/db")
  const where: Record<string, unknown> = { userId: user.id }
  if (dateFrom || dateTo) { const createdAt: Record<string, Date> = {}; if (dateFrom) createdAt.gte = new Date(dateFrom); if (dateTo) createdAt.lte = new Date(dateTo); where.createdAt = createdAt }
  const rows = await prisma.booking.findMany({ where: where as never, take: env.SEARCH_MAX_LIMIT, orderBy: { createdAt: "desc" } })
  const columns = ["id", "reference", "tripId", "seatCount", "totalAmount", "status", "createdAt"]
  return sendExport(reply, "bookings", dateFrom, dateTo, format, rows as unknown as Record<string, unknown>[], columns)
})
```
Copy exactly for `GET /payments/export` but `where: { booking: { userId: user.id } }` or `booking.userId` depending on query, columns `["id","bookingId","provider","amount","currency","status","createdAt"]`, admin sees all with `app.requireAuth("admin")` variant.

**Bulk action pattern** (lines 37-48) and `apps/api/src/app.ts` registration:
```typescript
// apps/api/src/app.ts lines 37-40
await app.register(authRoutes, { prefix: "/api/v1" })
await app.register(searchRoutes, { prefix: "/api/v1" })
await app.register(bookingRoutes, { prefix: "/api/v1" })
await app.register(adminSettingsRoutes, { prefix: "/api/v1" })
// Add: await app.register(paymentRoutes, { prefix: "/api/v1" })
// Webhooks: await app.register(notchpayWebhookRoutes, { prefix: "/api/v1" }) // or "/webhooks" depending on versioning decision
```

**Auth pattern** (from `apps/api/src/auth/plugins.ts` lines 19-28):
```typescript
app.decorate("requireAuth", function (role?: string) {
  return async (req: FastifyRequest) => {
    const header = req.headers.authorization
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedError()
    const token = header.slice(7)
    const claims = verifyAccessToken(token, env)
    if (role && claims.role !== role) throw new ForbiddenError()
    req.user = { id: claims.sub, role: claims.role }
  }
})
```
Use `preHandler: app.requireAuth()` for user payments, `app.requireAuth("admin")` or `"super_admin"` for list/export admin variant, and **no auth** for webhooks.

---

### `apps/api/src/payments/webhooks/notchpay.ts` + `cinetpay.ts` (route/middleware, event-driven)

**Analog:** No exact webhook analog exists. Closest partial is `apps/api/src/auth/routes.ts` lines 62-77 (Google callback handling external provider callback with code exchange + verification) + `packages/events/src/consumer.ts` in-memory dedup pattern. For structure, also reuse `apps/api/src/bookings/routes.ts` POST handler shape + RESEARCH webhook receipt pattern.

**Why partial:** Existing codebase has no `X-Notch-Signature`/`x-token` webhook today, only `GET /auth/google/callback` which validates external token via `googleProvider.verifyIdToken`. Payments webhooks are first `POST` webhook with raw-body HMAC.

**Pattern to copy — Google callback verification shape** (from `apps/api/src/auth/routes.ts` lines 62-77):
```typescript
app.get("/auth/google/callback", async (req, reply) => {
  const query = req.query as { code?: string }
  if (!query.code) throw new UnauthorizedError("Code manquant")
  const { id_token } = await googleProvider.exchangeCode(query.code)
  const profile = googleProvider.verifyIdToken(id_token)
  const user = await findOrCreateSocialUser({ ... })
})
```
Adapt to webhook: extract signature header, verify via `verifyNotchSignature(rawBody, sig, hashKey)`, return 401/403 on fail, log with `req.log.warn({ sigLen }, "webhook signature invalid")`.

**Raw body capture requirement:** RESEARCH pitfall 1 documents `fastify-raw-body` registration. No existing code uses rawBody — planner must add `await app.register(import("fastify-raw-body"), { field: "rawBody", global: true, encoding: "utf8", runFirst: true })` in `apps/api/src/app.ts`. Verify via RESEARCH code example lines 322-357:
```typescript
app.post("/webhooks/notchpay", { config: { rawBody: true } }, async (req, reply) => {
  const rawBody = (req as any).rawBody as string
  const sig = req.headers["x-notch-signature"] as string | undefined
  if (!sig) return reply.code(401).send({ error: "missing signature" })
  if (!verifyNotchSignature(rawBody, sig, env.NOTCHPAY_HASH_KEY)) {
    req.log.warn({ sigLen: sig?.length }, "webhook signature invalid")
    return reply.code(403).send({ error: "invalid signature" })
  }
  const event = JSON.parse(rawBody) as { id: string; type: string; data: { id: string; reference: string } }
  const deliveryId = event.id
  const claimed = await redis.set(`webhook:processed:${deliveryId}`, "processing", "EX", 300, "NX")
  if (claimed !== "OK") { req.log.info({ deliveryId }, "webhook duplicate, ack 200"); return reply.code(200).send({ status: "duplicate" }) }
  await kafkaProducer.publish(EVENT_TOPICS.paymentWebhookReceived, { id: deliveryId, type: event.type, data: event, aggregateId: event.data.reference } as never)
  return reply.code(200).send({ status: "received" })
})
```

**CinetPay variant specifics (from RESEARCH lines 362-390):**
- Content-Type is `application/x-www-form-urlencoded`, parse with `Object.fromEntries(new URLSearchParams(rawBody).entries())`
- Header is `x-token`, concat 15 fields in fixed order, verify with `crypto.timingSafeEqual` + fallback `Object.values(parsed).join("")`
- DeliveryId is composite `cinetpay:${cpm_trans_id}:${cpm_trans_date}`
- Must enqueue then worker calls `POST /v2/payment/check` — never trust `cpm_amount` directly

**Dedup pattern (from `packages/events/src/consumer.ts` lines 20-28 + RESEARCH idempotency):**
```typescript
const processedIds = new Set<string>()
const markProcessed = (id: string) => { processedIds.add(id); if (processedIds.size > MAX_PROCESSED_IDS) { const oldest = processedIds.values().next().value; if (oldest) processedIds.delete(oldest) } }
```
For payments, use Redis `SET NX` as durable version — in-memory set is only second layer (worker fan-out). Copy both layers.

---

### `apps/api/src/payments/webhooks/verify.ts` (utility, transform)

**Analog:** `apps/api/src/auth/password.ts` (crypto wrapper) — not read but pattern is pure `node:crypto` helper isolated in one file, imported elsewhere. Also `packages/config/src/env.ts` style pure function.

**Pattern to copy — argon2 password hashing shows isolation:**
- File exports pure `hashPassword` / `verifyPassword` functions with no side effects.
- For webhooks, export `verifyNotchSignature(rawBody: string, signature: string, hashKey: string): boolean` and `verifyCinetToken(form: Record<string,string>, xToken: string, secretKey: string): boolean`
- Use `crypto.createHmac("sha256", secret).update(rawBody).digest("hex")` + `crypto.timingSafeEqual(Buffer.from(expected,"hex"), Buffer.from(signature,"hex"))` with try/catch return false
- This file is the only place handling hex encoding + timingSafeEqual — other webhook routes import from here, never inline HMAC

**Code to copy exactly from RESEARCH lines 540-551 and 627-642** (verified docs source):
```typescript
import crypto from "node:crypto"
export function verifyNotchSignature(rawBody: string, signature: string, hashKey: string): boolean {
  const expected = crypto.createHmac("sha256", hashKey).update(rawBody).digest("hex")
  try { return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex")) } catch { return false }
}
export function verifyCinetToken(form: Record<string,string>, xToken: string, secretKey: string): boolean {
  const data = (form.cpm_site_id ?? "") + (form.cpm_trans_id ?? "") + (form.cpm_trans_date ?? "") + (form.cpm_amount ?? "") + (form.cpm_currency ?? "") + (form.signature ?? "") + (form.payment_method ?? "") + (form.cel_phone_num ?? "") + (form.cpm_phone_prefixe ?? "") + (form.cpm_language ?? "") + (form.cpm_version ?? "") + (form.cpm_payment_config ?? "") + (form.cpm_page_action ?? "") + (form.cpm_custom ?? "") + (form.cpm_designation ?? "") + (form.cpm_error_message ?? "")
  const expected = crypto.createHmac("sha256", secretKey).update(data).digest("hex")
  try { return crypto.timingSafeEqual(Buffer.from(expected,"hex"), Buffer.from(xToken,"hex")) } catch { return false }
}
```

---

### `apps/api/src/payments/providers/types.ts` + `providers/index.ts` (provider/interface)

**Analog:** `packages/events/src/types.ts` (lines 1-7) + `packages/events/src/topics.ts` (lines 1-9) for interface/constants pattern + `apps/api/src/auth/social.ts` for provider abstraction

**Imports pattern (from topics.ts lines 1-9):**
```typescript
export const EVENT_TOPICS = {
  bookingCreated: "camermove.booking.created",
  paymentCompleted: "camermove.payment.completed",
  ticketIssued: "camermove.ticket.issued",
} as const
export type EventTopic = (typeof EVENT_TOPICS)[keyof typeof EVENT_TOPICS]
```

**Copy for `SupportedProvider`:**
```typescript
export const PAYMENT_PROVIDERS = {
  notchpay: "notchpay",
  cinetpay: "cinetpay",
} as const
export type SupportedProvider = (typeof PAYMENT_PROVIDERS)[keyof typeof PAYMENT_PROVIDERS]
export type PaymentMethod = "mobile_money" | "card" | "bank_transfer"
export interface PaymentProvider {
  readonly name: SupportedProvider
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>
  verifyPayment(providerRef: string): Promise<VerifyPaymentResult>
  verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret: string): boolean
}
```

**Factory pattern (from social.ts GoogleProvider — single export `googleProvider` with methods):**
```typescript
// apps/api/src/auth/social.ts exports: googleProvider.getAuthUrl, exchangeCode, verifyIdToken
export const googleProvider = { getAuthUrl, exchangeCode, verifyIdToken }
// For payments:
export function getProvider(name: SupportedProvider): PaymentProvider {
  if (name === "notchpay") return new NotchPayAdapter(loadEnv())
  if (name === "cinetpay") return new CinetPayAdapter(loadEnv())
  throw new BadRequestError(`Provider inconnu: ${name}`)
}
```

---

### `apps/api/src/payments/providers/notchpay.adapter.ts` + `cinetpay.adapter.ts` (provider/service, request-response)

**Analog:** `apps/api/src/auth/social.ts` (GoogleProvider adapter) — closest enterprise provider adapter in codebase. Also `apps/worker/src/notifications/channels/email.ts` for external HTTP call shape.

**Pattern from RESEARCH lines 271-310 (NotchPayAdapter) — adapt to codebase style:**
- Constructor takes `env: { NOTCHPAY_BASE_URL: string; NOTCHPAY_PUBLIC_KEY: string; NOTCHPAY_HASH_KEY: string }` from `loadEnv()` (like `googleProvider` takes env)
- `createPayment` uses native `fetch` with `Authorization: env.NOTCHPAY_PUBLIC_KEY` header, `JSON.stringify({ amount, currency, email, phone, reference, callback, description })`, handles non-ok with throw, parses `transaction.id + authorization_url`
- `verifyWebhookSignature` delegates to `verify.ts` helper
- `verifyPayment` does `fetch GET /payments/${reference}` with same Authorization

**CinetPay adapter differences to capture:**
- Base url `https://api-checkout.cinetpay.com/v2/payment` for create, `/v2/payment/check` for verify
- Constructor needs `{ CINETPAY_APIKEY, CINETPAY_SITE_ID, CINETPAY_SECRET_KEY }`
- `createPayment` body includes `apikey, site_id, transaction_id (=reference), amount (multiple of 5), currency, notify_url, return_url, channels`
- `verifyPayment` is `POST /v2/payment/check` with `apikey, site_id, transaction_id` — success is `code==="00" && data.status==="ACCEPTED"` + amount check

**No `notchpay-api` SDK** — RESEARCH Package Legitimacy Audit flags `notchpay-api` as SUS (low downloads, unofficial) and `notchpay`/`cinetpay` bare packages as SLOP (404). Planner must add `checkpoint:human-verify` before any SDK install; default to raw `fetch` per RESEARCH Recommendation §Summary line 53.

---

### `apps/api/src/payments/jobs/reconciliation.ts` + `refund.ts` (job/worker, batch/event-driven)

**Analog:** `apps/api/src/bookings/service.ts` `expireHolds()` (lines 43-57) for cron batch pattern + `apps/worker/src/index.ts` (lines 1-17) for worker wiring + `apps/worker/src/notifications/service.ts` (lines 1-22) for worker service shape

**Batch job pattern (from expireHolds lines 43-57):**
```typescript
export async function expireHolds(): Promise<number> {
  const expired = await prisma.booking.findMany({ where: { status: "pending_payment", holdExpiresAt: { lt: new Date() } } })
  let count = 0
  for (const b of expired) {
    await prisma.$transaction(async (tx: any) => {
      await tx.booking.update({ where: { id: b.id }, data: { status: "expired" } })
      const sa = await tx.seatAvailability.findUnique({ where: { tripId: b.tripId } })
      if (sa && sa.seatsHeld >= b.seatCount) {
        await tx.seatAvailability.update({ where: { tripId: b.tripId }, data: { seatsAvailable: { increment: b.seatCount }, seatsHeld: { decrement: b.seatCount } } })
      }
    })
    count++
  }
  return count
}
```

**Copy for reconciliation:**
```typescript
export async function reconcileStalePayments(): Promise<number> {
  const stale = await prisma.payment.findMany({ where: { status: { in: ["pending","processing"] }, createdAt: { lt: new Date(Date.now() - 5*60*1000) } } })
  let count = 0
  for (const p of stale) {
    const provider = getProvider(p.provider as SupportedProvider)
    const verified = await provider.verifyPayment(p.providerRef!)
    if (verified.status === "success") await confirmPaymentSuccess(p.providerRef!, verified.rawPayload)
    else if (verified.status === "failed" || verified.status === "expired") await failPayment(p.id, verified.rawPayload)
    count++
  }
  return count
}
// Scheduled via BullMQ repeatable job: new Queue("payment-reconciliation", { connection: getRedis() }).add("reconcile", {}, { repeat: { pattern: "0 * * * *" } })
// Or simple setInterval in worker if BullMQ not yet installed
```

**Worker wiring pattern (from apps/worker/src/index.ts lines 1-17):**
```typescript
import { loadEnv } from "@camermove/config"
import { createKafkaClient, createEventConsumer, EVENT_TOPICS } from "@camermove/events"
import { createNotificationService } from "./notifications/service"
const env = loadEnv()
const kafka = createKafkaClient(env)
const consumer = createEventConsumer(kafka, env, {
  [EVENT_TOPICS.notificationShouldSend]: async (event) => { await notifications.send(event.data as never) },
  [EVENT_TOPICS.bookingCreated]: async () => {},
  [EVENT_TOPICS.paymentCompleted]: async () => {},
})
async function main() { await consumer.connect(); console.log("worker running") }
```
Add for payments:
```typescript
[EVENT_TOPICS.paymentWebhookReceived]: async (event) => { await processPaymentWebhook(event.data) }, // does tx + commission + publish paymentCompleted
[EVENT_TOPICS.paymentCompleted]: async (event) => { /* Phase 4 ticket will consume */ },
```

**Notification service shape (from apps/worker/src/notifications/service.ts lines 7-22):**
```typescript
export function createNotificationService(env: Env) {
  return {
    async send(input: SendInput) {
      const notification = await prisma.notification.create({ data: { ... } })
      try { ...; await prisma.notification.update({ where: { id: notification.id }, data: { status: "sent" } }) }
      catch (err) { await prisma.notification.update({ where: { id: notification.id }, data: { status: "failed" } }) }
    },
  }
}
```
For refund job: `createRefundService(env)` with `async refundPayment(paymentId, amount)` that calls `provider.refundPayment` if supported, otherwise marks `Payment.status="refunded"` + `Booking.status="refunded"` per `cancelBooking` line 104.

---

### `packages/shared/src/money.ts` (new, utility/shared, transform)

**Analog:** No file exists in `packages/shared` (glob returned no files) — package is currently empty/decoupled. Closest analog is `apps/api/src/bookings/cancellation.ts` lines 121-122 for money rounding.

**Pattern to copy:**
```typescript
// packages/shared/src/money.ts — integer XAF, no floating
export function calcCommission(gross: number, percent: number) {
  const commissionAmount = Math.round((gross * percent) / 100)
  const netAmount = gross - commissionAmount
  return { commissionAmount, netAmount, percentApplied: percent }
}
export function calcRefund(gross: number, refundPercent: number) {
  return Math.round((gross * refundPercent) / 100)
}
// Export via packages/shared barrel if exists
```

**AGENTS.md §4 Shared math** mandates `packages/shared` money logic once, reused by API and future mobile — planner must create file there, not in `apps/api/src/lib`.

---

### Modified files

#### `packages/events/src/topics.ts` (modify, partial)

**Analog:** Itself (lines 1-9)
```typescript
export const EVENT_TOPICS = {
  bookingCreated: "camermove.booking.created",
  paymentCompleted: "camermove.payment.completed",
  ticketIssued: "camermove.ticket.issued",
  seatHeldExpired: "camermove.seat.held.expired",
  notificationShouldSend: "camermove.notification.should-send",
} as const
```
**Add:** `paymentWebhookReceived: "camermove.payment.webhook.received"`, `paymentFailed: "camermove.payment.failed"`, `paymentRefunded: "camermove.payment.refunded"`, `paymentInitiated: "camermove.payment.initiated"` — keep `as const` + `EventTopic` type.

#### `packages/config/src/env.ts` (modify, partial)

**Analog:** Itself (lines 24-70)
```typescript
const EnvSchema = z.object({
  NOTCHPAY_BASE_URL: z.string().url().default('https://api.notchpay.co'),
  NOTCHPAY_PUBLIC_KEY: secret,
  NOTCHPAY_PRIVATE_KEY: secret,
  NOTCHPAY_HASH_KEY: secret,
  // Add:
  CINETPAY_APIKEY: z.string().optional(), // required for CinetPay create/check
  CINETPAY_SITE_ID: z.string().optional(), // coerce to number string
  CINETPAY_SECRET_KEY: secret.optional(),
  CINETPAY_BASE_URL: z.string().url().default('https://api-checkout.cinetpay.com'),
})
```
Per RESEARCH A5 — planner gats with `checkpoint:human-verify` if CinetPay secrets stored elsewhere (AppSettings).

#### `packages/db/prisma/schema.prisma` (modify, migration)

**Analog:** Itself (lines 37-53 enums, 237-250 Payment model, 315-328 AppSettings)
```prisma
enum PaymentProvider { notchpay } // Add: cinetpay
model Payment {
  id             String          @id @default(cuid())
  bookingId      String
  booking        Booking         @relation(fields: [bookingId], references: [id], onDelete: Restrict)
  provider       PaymentProvider @default(notchpay)
  providerRef    String?
  amount         Int
  method         PaymentMethod?
  currency       String          @default("XAF")
  status         PaymentStatus   @default(pending)
  webhookPayload Json?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}
```
**Changes needed:**
- `enum PaymentProvider { notchpay, cinetpay }`
- Add `@@index([status, createdAt])` and `@@unique([provider, providerRef])` or `@@index([bookingId, status])` + partial unique for pending (see RESEARCH Pitfall 6): `@@unique([bookingId, status])` is too wide — prefer app guard + migrate adding `@@index([providerRef])`
- Ensure `Commission.bookingId @unique` already exists (line 254) — guard against duplicate commission on webhook replay
- `AppSettings.featureFlags` already `Json?` (line 324) — stores `transporterCommissions` map, no schema change needed but planner must document shape

## Shared Patterns

### Authentication (RBAC)

**Source:** `apps/api/src/auth/plugins.ts` lines 19-28 + `apps/api/src/admin/settings.ts` lines 18 + 28

**Apply to:** `POST /payments`, `GET /payments`, `GET /payments/:id`, `GET /payments/export`, `GET /admin/payments/*`

```typescript
// apps/api/src/auth/plugins.ts lines 19-28
app.decorate("requireAuth", function (role?: string) {
  return async (req: FastifyRequest) => {
    const header = req.headers.authorization
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedError()
    const token = header.slice(7)
    const claims = verifyAccessToken(token, env)
    if (role && claims.role !== role) throw new ForbiddenError()
    req.user = { id: claims.sub, role: claims.role }
  }
})
// Usage:
// app.post("/payments", { preHandler: app.requireAuth() }, handler) // traveler
// app.get("/admin/payments", { preHandler: app.requireAuth("admin") }, handler)
// app.get("/admin/settings", { preHandler: app.requireAuth("super_admin") }, handler) // from admin/settings.ts line 18
// Webhooks: NO auth — verify via HMAC instead
```

### Error Handling

**Source:** `packages/config/src/errors.ts` lines 1-35 + `apps/api/src/app.ts` lines 27-36

**Apply to:** All service + route files

```typescript
// packages/config/src/errors.ts lines 1-35
export class AppError extends Error { status: number; code: string; constructor(status: number, code: string, message: string) { super(message); this.name = 'AppError'; this.status = status; this.code = code } }
export class BadRequestError extends AppError { constructor(msg = 'Requête invalide', code = 'BAD_REQUEST') { super(400, code, msg) } }
export class UnauthorizedError extends AppError { constructor(msg = 'Non autorisé', code = 'UNAUTHORIZED') { super(401, code, msg) } }
export class ForbiddenError extends AppError { constructor(msg = 'Accès refusé', code = 'FORBIDDEN') { super(403, code, msg) } }
export class NotFoundError extends AppError { constructor(msg = 'Introuvable', code = 'NOT_FOUND') { super(404, code, msg) } }
export class ConflictError extends AppError { constructor(msg = 'Conflit', code = 'CONFLICT') { super(409, code, msg) } }
// Handler in apps/api/src/app.ts lines 27-36
app.setErrorHandler((err, req, reply) => {
  if (err instanceof AppError) return reply.code(err.status).send({ error: err.code, message: err.message })
  if (err && typeof err === "object" && "issues" in (err as Record<string, unknown>)) return reply.code(400).send({ error: "VALIDATION", message: (err as Error).message })
  req.log.error(err); return reply.code(500).send({ error: "INTERNAL", message: "Erreur interne" })
})
```

### Validation

**Source:** `apps/api/src/bookings/schema.ts` lines 1-11 + `apps/api/src/bookings/routes.ts` lines 12,21,38 + `packages/config/src/env.ts` Zod usage

**Apply to:** All POST/PUT/PATCH handlers + query params

```typescript
// Define once in schema.ts
import { z } from "zod"
export const CreatePaymentBody = z.object({ bookingId: z.string().cuid(), provider: z.enum(["notchpay","cinetpay"]), phone: z.string().optional() })
// Parse in handler — throws ZodError caught by error handler as 400 VALIDATION
const body = CreatePaymentBody.parse(req.body)
const params = z.object({ id: z.string().cuid() }).parse(req.params)
const query = PaymentListQuery.parse(req.query) // which extends PaginationSchema + FilterSchema from lib/query.ts
```

### Idempotency (POST replay)

**Source:** `apps/api/src/plugins/idempotency.ts` lines 1-43

**Apply to:** `POST /payments` (mandated by AGENTS.md §1) + indirectly webhooks via Redis NX

```typescript
// apps/api/src/plugins/idempotency.ts lines 11-43 — global hook, no per-route opt-in
export const idempotencyPlugin = fp(async (app: FastifyInstance) => {
  app.addHook("preHandler", async (req, reply) => {
    if (!["POST", "PUT", "PATCH"].includes(req.method)) return
    const key = req.headers["idempotency-key"] as string | undefined
    if (!key) return
    const cacheKey = `idemp:${req.url}:${key}`
    // Redis get + JSON.parse; if hit return reply.code(cached.status).send(cached.body)
    // Else monkey-patch reply.send to cache 86400s via setex
  })
})
// Already registered in apps/api/src/app.ts line 25: await app.register(idempotencyPlugin)
// For payments: client MUST send Idempotency-Key header; planner must document that replays return same authorization_url without re-calling provider
// Additional guard: one-pending-per-booking via DB findFirst inside service (RESEARCH Pitfall 6)
```

### Rate Limiting

**Source:** `apps/api/src/plugins/rateLimit.ts` lines 1-76

**Apply to:** `POST /payments` + `POST /webhooks/*` (webhooks need distinct, looser limits — not burst-blocked)

```typescript
// apps/api/src/plugins/rateLimit.ts lines 37-71 — auto dual-layer per IP + app, Redis + memory fallback, 429 with Retry-After
export const rateLimitPlugin = fp(async (app: FastifyInstance) => {
  const env = loadEnv()
  app.addHook("preHandler", async (req, reply) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? "unknown"
    const path = req.url.split("?")[0] ?? ""
    const windowMs = env.RATE_LIMIT_WINDOW_MS
    let ipMax = env.RATE_LIMIT_IP_GENERAL_MAX
    if (path.startsWith("/api/v1/auth")) ipMax = env.RATE_LIMIT_IP_AUTH_MAX
    else if (path.startsWith("/api/v1/search")) ipMax = env.RATE_LIMIT_IP_SEARCH_MAX
    // For payments: decide if add env.RATE_LIMIT_IP_PAYMENTS_MAX — else falls to GENERAL (100/min)
    // Webhooks: consider bypass or ipMax=200 for provider IPs
  })
})
```

### Metadata + Audit Log

**Source:** `apps/api/src/plugins/metadata.ts` lines 40-57 + `apps/api/src/bookings/routes.ts` lines 14-16 + `apps/api/src/admin/settings.ts` lines 20,31

**Apply to:** `POST /payments`, `POST /webhooks/*` (log only), `GET /payments/export`

```typescript
// apps/api/src/plugins/metadata.ts lines 40-57 — adds req.meta = { ip, userAgent, os, browser, device, referer, requestId } + req.log.info({ ip, os, browser, device, requestId, url: req.url }, "request meta")
declare module "fastify" { interface FastifyRequest { meta: { ip: string; userAgent: string; os: string; browser: string; device: string; referer?: string; requestId: string } } }

// Per-endpoint logging + audit (from bookings/routes.ts lines 14-16 + bookings/service.ts lines 109-117)
const meta = (req as unknown as { meta: Record<string, unknown> }).meta
req.log.info({ ...meta, tripId: body.tripId, seatCount: body.seatCount, passengerCount: body.passengers.length, userId: user.id }, "booking.create")
// For payments: req.log.info({ ...meta, bookingId, provider, amount, ip: meta.ip, ua: meta.userAgent }, "payment.create")
// AuditLog per AGENTS.md §2: bookingId, amount, provider, ip, ua → Payment.webhookPayload audit
await prisma.auditLog.create({ data: { actorId: user.id, action: "payment.create", entityType: "Payment", entityId: payment.id, metadata: { ...meta, bookingId, provider, amount } as never } })
// Webhook audit: metadata: event as any + provider name
```

### Caching (reuse for AppSettings)

**Source:** `apps/api/src/lib/cache.ts` lines 1-37 + `apps/api/src/lib/redis.ts` lines 1-23

**Apply to:** `computeCommission` AppSettings 30s cache

```typescript
// apps/api/src/lib/cache.ts lines 5-37
export async function getCached<T>(key: string): Promise<T | null> { try { const redis = getRedis(); const raw = await redis.get(key); if (!raw) return null; return JSON.parse(raw) as T } catch { return null } }
export async function setCached(key: string, value: unknown, ttl = DEFAULT_TTL): Promise<void> { try { const redis = getRedis(); await redis.setex(key, ttl, JSON.stringify(value)) } catch {} }
export function cacheKey(prefix: string, params: Record<string, unknown>): string { const sorted = Object.keys(params).sort().map((k) => `${k}=${String(params[k])}`).join("&"); return `${prefix}:${sorted}` }

// For AppSettings: const cached = await getCached<AppSettings>("appsettings:global"); if (cached) return cached; const settings = await prisma.appSettings.findUnique({ where:{ id:"global" } }); await setCached("appsettings:global", settings, 30); return settings

// apps/api/src/lib/redis.ts lines 6-16 — singleton ioredis with lazyConnect, getRedis()/closeRedis()
export function getRedis(): IORedis { if (client) return client; const env = loadEnv(); client = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: 2, enableReadyCheck: true, lazyConnect: true }); client.on("error", (err: Error) => console.warn("redis error", err.message)); return client }
```

### Export Streaming

**Source:** `apps/api/src/lib/export.ts` lines 1-36 + `apps/api/src/bookings/routes.ts` lines 50-66

**Apply to:** `GET /payments/export` (+ future `GET /commissions/export`)

```typescript
// apps/api/src/lib/export.ts lines 3-36
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string { const header = columns.join(","); const lines = rows.map((r) => columns.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(",")); return [header, ...lines].join("\n") }
export async function sendExport(reply: FastifyReply, resource: string, dateFrom: string | undefined, dateTo: string | undefined, format: "json" | "csv", rows: Record<string, unknown>[], columns: string[]) { const from = dateFrom ?? "all"; const to = dateTo ?? "all"; const filename = `export-${resource}-${from}-${to}.${format}`; if (format === "csv") { const csv = toCsv(rows, columns); return reply.header("Content-Type", "text/csv").header("Content-Disposition", `attachment; filename="${filename}"`).send(csv) } return reply.header("Content-Disposition", `attachment; filename="${filename}"`).send(rows) }
export function parseExportQuery(query: Record<string, unknown>) { const dateFrom = query.dateFrom as string | undefined; const dateTo = query.dateTo as string | undefined; const format = (query.format as string) === "csv" ? "csv" as const : "json" as const; ... return { dateFrom, dateTo, format, q, groupBy, orderBy } }
// Enforces AGENTS.md §6: dateFrom/dateTo ISO, streamed CSV, RBAC, SEARCH_MAX_LIMIT, Content-Disposition attachment
```

### Transactions / Row Locks (ACID)

**Source:** `packages/db/src/repositories/seat.repository.ts` lines 8-43 + `apps/api/src/bookings/service.ts` lines 47-54, 91-96

**Apply to:** `confirmPaymentSuccess`, `failPayment`, `reconcile`, `expireHolds` interaction

```typescript
// packages/db/src/repositories/seat.repository.ts lines 8-24 — SELECT FOR UPDATE
export async function atomicHoldSeats(tripId: string, count: number): Promise<boolean> {
  const result = await prisma.$transaction(async (tx: any) => {
    const rows = await tx.$queryRaw<Array<{ seatsAvailable: number; seatsHeld: number }>>`SELECT "seatsAvailable","seatsHeld" FROM "SeatAvailability" WHERE "tripId" = ${tripId} FOR UPDATE`
    const row = rows[0]; if (!row) throw new ConflictError("Aucune disponibilité pour ce trajet"); if (row.seatsAvailable < count) throw new ConflictError("Places insuffisantes")
    await tx.seatAvailability.update({ where: { tripId }, data: { seatsAvailable: { decrement: count }, seatsHeld: { increment: count } } }); return true
  }); return result
}
// For payments: inside prisma.$transaction also SELECT Booking + SeatAvailability FOR UPDATE to serialize against expireHolds
await prisma.$transaction(async (tx: any) => {
  const rows = await tx.$queryRaw`SELECT "status" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`
  // Then update Payment + Booking + SeatAvailability + Commission + AuditLog atomically
})
```

### Events / Async (Kafka + Worker)

**Source:** `packages/events/src/kafka.ts` + `packages/events/src/producer.ts` lines 9-28 + `packages/events/src/consumer.ts` lines 13-70 + `apps/worker/src/index.ts` lines 1-17 + `packages/events/src/topics.ts`

**Apply to:** Webhook enqueue → worker processing + `payment.completed` → Phase 4 ticket

```typescript
// packages/events/src/producer.ts lines 9-22 — idempotent producer
export function createEventProducer(kafka: Kafka, env: Env) {
  const producer = kafka.producer({ idempotent: true })
  return { async connect() { await producer.connect() }, async publish<T>(topic: EventTopic, event: DomainEvent<T>) { await producer.send({ topic, messages: [{ key: event.aggregateId, value: JSON.stringify(event) }] }); log.info({ topic, id: event.id }, "event published") }, async disconnect() { await producer.disconnect() } }
}
// packages/events/src/consumer.ts lines 13-70 — subscribes per topic, dedups via Set, manual commit, throw to retry
export function createEventConsumer(kafka: Kafka, env: Env, handlers: Partial<Record<EventTopic, EventHandler>>) {
  const consumer = kafka.consumer({ groupId: `camermove-worker-${env.NODE_ENV}` })
  // eachMessage: JSON.parse(message.value), if processedIds.has(event.id) commit; else await handler(event); markProcessed; commit; catch throw
}
// packages/events/src/types.ts lines 1-7 — DomainEvent shape
export interface DomainEvent<T = unknown> { id: string; type: string; ts: string; aggregateId: string; data: T }
// For payments: publish DomainEvent with id=deliveryId, type="payment.webhook.received" | "payment.completed", aggregateId=booking.reference
```

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/api/src/payments/webhooks/verify.ts` | utility | transform (HMAC) | No existing `crypto.timingSafeEqual` HMAC in codebase; only `argon2` in auth. Use RESEARCH lines 540-551 / 627-642 verbatim. |
| `apps/api/src/payments/providers/cinetpay.adapter.ts` | provider | request-response | No second payment provider exists; NotchPay env only. Use RESEARCH CinetPay check pattern + fallback HMAC (lines 604-622). |
| `apps/api/src/payments/providers/notchpay.adapter.ts` (partial) | provider | request-response | NotchPay provider call does not exist yet; closest is `auth/social.ts` GoogleProvider but HTTP shape differs. Planner copies fetch pattern from RESEARCH lines 271-310. |
| `packages/shared/src/money.ts` | utility/shared | transform | No `packages/shared` files exist yet (glob empty). Planner creates per AGENTS.md §4 Shared math + cancellation.ts rounding lines 121-122. |

Duplicates/replay protection for webhooks also has no durable Redis `SET NX` analog in codebase — existing idempotency uses `idempotencyPlugin` with `getRedis().setex` on replay cache, but webhooks need `SET NX` before enqueue. Planner should reference RESEARCH BullMQ/Kafka pattern lines 322-390.

## Metadata

**Analog search scope:** `apps/api/src` (20 files), `packages/db/src` (4 files), `packages/config/src` (5 files), `packages/events/src` (6 files), `apps/worker/src` (5 files), `packages/shared` (empty)

**Files scanned:** ~40

**Pattern extraction date:** 2026-08-25

**Key cross-file decision for planner:**
- Register order in `apps/api/src/app.ts`: `metadataPlugin` → `rateLimitPlugin` → `idempotencyPlugin` → `authPlugin` already exists (lines 23-26). Add `fastify-raw-body` BEFORE `metadataPlugin` for webhooks raw body capture.
- Payment creation MUST use both `idempotencyPlugin` (header) AND service-level one-pending guard (DB) per RESEARCH Pitfall 6.
- Commission reads `AppSettings` singleton (id="global") with 30s Redis cache — mirror `cancellation.ts` `getCancellationTiers()` try/catch fallback to `DEFAULT_TIERS`.
- Postgres triggers `trg_seat_check` mentioned in AGENTS.md §1 ACID are assumed present via migration; planner should verify `SeatAvailability` invariants `seatsAvailable >=0` handled by triggers, not app check alone.


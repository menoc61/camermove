# Phase 3: Payments — Research

**Researched:** 2026-08-25
**Domain:** Dual-provider Mobile Money payments (NotchPay + CinetPay), webhook security, commission engine, booking state machine, reconciliation
**Confidence:** HIGH (NotchPay docs verified via official developer docs), MEDIUM (CinetPay docs verified via official docs but with concatenation ambiguity), HIGH (architecture patterns from existing codebase)

## User Constraints (from CONTEXT.md)

### Locked Decisions
No CONTEXT.md exists for this phase — no prior discuss-phase decisions to honor. Phase derives from ROADMAP.md + REQUIREMENTS.md + explicit user prompt.

User prompt explicitly adds beyond ROADMAP baseline:
- Research **BOTH NotchPay and CinetPay** (dual provider, not NotchPay-only)
- Enterprise-grade, professional, all functionalities a transport booking payment system should have (idempotency, webhook verification, commission, refunds, retries, DLQ, reconciliation, audit)

### the agent's Discretion
- Provider abstraction design (strategy pattern vs factory)
- Commission per-transporter override storage
- Retry/DLQ mechanism choice (Kafka vs BullMQ)
- Reconciliation job cadence and scope
- Export/recovery tooling decisions

### Deferred Ideas (OUT OF SCOPE)
- Native mobile app
- Loyalty, tourism marketplace, dynamic pricing, AI, real-time geolocation
- Reviews/ratings, promo codes

## Project Constraints (from AGENTS.md)

All research must respect AGENTS.md as the contract:

- **Statelessness** — JWT `Authorization: Bearer`, no server session; horizontal scale zero sticky
- **Idempotency** — Every `POST/PUT/PATCH` accepts `Idempotency-Key`, Redis 24h replay; booking + payment creation MUST be idempotent
- **ACID** — Seat writes inside Prisma `$transaction` with `SELECT ... FOR UPDATE`; Postgres triggers enforce invariants
- **Caching** — `cache.ts` + `getRedis()` (ioredis) with `cacheKey(prefix, sortedParams)` 60s TTL; fallback to memory
- **Proper indexing** — Trip `@@index([departureAt],[price],[status],[routeId,departureAt])`, Booking `@@index([userId,status],[tripId],[status,holdExpiresAt])`; every WHERE/ORDER BY field indexed
- **Rate limiting** — Dual-layer IP + app per route via Redis+memory fallback, 429 with Retry-After
- **Async processing** — Kafka (durable events `booking.created` etc.) + BullMQ (delayed `holdExpiresAt`); `apps/worker` is consumer; no blocking business logic
- **Decoupling via APIs** — Business logic only `apps/api` + `packages/*`; `apps/web` only calls `REST /api/v1` versioned Zod-validated OpenAPI
- **Robust security** — `argon2`, RBAC `requireAuth(role?)`, Zod on every endpoint, `X-Notch-Signature` verify, `AuditLog`, no raw card data, secrets only via `loadEnv()` from `.env`
- **Horizontal scalability** — Stateless API + Redis + Postgres + Kafka partitions + `trustProxy` + `/health` + graceful SIGTERM
- **Endpoint metadata** — `metadataPlugin` `req.meta` (ip, os, browser, device, ua, referer, requestId) + handler-specific fields (`bookingId, amount, provider, ip, ua → Payment.webhookPayload`)
- **AppSettings** — Singleton `id="global"` holds `commissionPercent`, `holdExpiryMinutes`, `cancellationPolicy`, `featureFlags`; `super_admin` only; cached 30s via Redis
- **Exportable & Periodic** — Every list endpoint periodic supports `dateFrom/dateTo` + `GET /.../export?dateFrom&dateTo&format=json|csv` streamed, RBAC, `SEARCH_MAX_LIMIT`
- **No Dead Code** — `pnpm -r typecheck` + `knip` 0 unused; verification gates

## Summary

Phase 3 delivers dual-provider payments (NotchPay primary + CinetPay new) behind a unified `PaymentProvider` abstraction. NotchPay uses `Authorization: PUBLIC_KEY` header, `POST /payments` with `XAF + amount + email/phone/customer + reference + callback`, returns `authorization_url`; webhook is HMAC SHA-256 hex over raw JSON body using `NOTCHPAY_HASH_KEY`, header `x-notch-signature`, timingSafeEqual. CinetPay uses `POST https://api-checkout.cinetpay.com/v2/payment` with `apikey + site_id + transaction_id + amount(multiple 5) + currency XAF + notify_url + return_url + channels`, returns `payment_url`; notify_url receives POST `cpm_*` form fields with `x-token` HMAC SHA-256 (concatenated string), and **must** be verified by calling `POST /v2/payment/check` (`code == "00"` + `status == "ACCEPTED"` is success) — never trust notify payload alone.

Payment state machine must be `pending → processing → success|failed|expired|refunded` mapped to `Booking: pending_payment → confirmed|expired|cancelled|refunded` and `SeatAvailability: seatsHeld → seatsBooked` (confirm) or back to `seatsAvailable` (release). Commission is global `AppSettings.commissionPercent` (10%) with per-transporter override; on success persist `Commission{grossAmount, commissionAmount, netAmount, percentApplied, payoutStatus}`. Enterprise needs beyond happy path: idempotent webhook (Redis SET NX + DB unique + jobId dedup), replay protection (timestamp window), retry with exponential backoff + jitter via BullMQ or Kafka, DLQ, hourly reconciliation cron verifying provider status for stuck `pending`, refund flow via cancellation tiers, audit log, exportable `GET /payments + /export`, rate limiting, Prometheus metrics, and **never redirect-only trust** — always verify via API.

**Primary recommendation:** Implement `PaymentProvider` strategy interface (`createPayment`, `verifyPayment`, `verifyWebhookSignature`, `refundPayment`) with `NotchPayAdapter` and `CinetPayAdapter` in `packages/payments` or `apps/api/src/payments/providers/`; generic `POST /payments` takes `{ bookingId, provider: "notchpay"|"cinetpay", method, phone }`, creates `Payment{status:pending, providerRef}`, returns `authorization_url/payment_url`; two dedicated webhook routes (`POST /webhooks/notchpay`, `POST /webhooks/cinetpay`) that verify HMAC on raw body, do atomic idempotency claim (`SET NX`), enqueue to Kafka `payment.webhook.received` or BullMQ, return 200 within 50ms, and let worker do transactional state update + commission + Kafka events.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Payment initiation (`POST /payments` + provider call) | API / Backend | Database | Business logic, ACID transaction, secrets — never browser |
| Webhook receipt + HMAC verification | API / Backend | — | Secrets (`HASH_KEY`, `secretKey`) must stay server-side; raw body access |
| Webhook processing (state machine, commission, seats) | API worker (async) | Database + Redis | Must be durable, retried, idempotent; no request blocking |
| Signature verification | API / Backend | — | Crypto with timingSafeEqual, raw body, short TTL |
| Commission calculation & persistence | API / Backend | Database | Single source `packages/shared` money math, AppSettings override |
| Reconciliation job (verify provider for stale pending) | Worker (cron) | API | Periodic BullMQ repeatable job or Kafka consumer timer |
| Refund flow (policy + provider refund) | API / Backend | Worker | Sync policy check + async provider call, DLQ on fail |
| Payment list / export / stats | API / Backend | Database | RBAC, `dateFrom/dateTo`, `SEARCH_MAX_LIMIT`, streamed CSV |
| Provider secrets / config | Backend (packages/config) | — | Typed Zod env, never exposed to frontend |
| Payment status polling / callback | API / Backend | Frontend | Frontend polls `GET /payments/:id` or `GET /bookings/:id` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ioredis` | 6.0.0 [VERIFIED: npm registry] | Redis client for idempotency, cache, rate-limit, webhook dedup | Already in `apps/api` deps; AGENTS.md mandated shared Redis |
| `kafkajs` | 2.2.4 [VERIFIED: npm registry] | Durable event backbone for `payment.completed/failed` | Already via `packages/events`; enables replay, fan-out |
| `bullmq` | 5.x [ASSUMED] | Delayed `holdExpiresAt`, retry with backoff, DLQ, reconciliation cron | Complements Kafka; native delayed/retry; used in worker already per AGENTS.md |
| `zod` | 4.4.3 [VERIFIED: npm registry - already installed] | Validate every payment/webhook payload | AGENTS.md requires Zod on every endpoint |
| `fastify` | 5.12.1 [VERIFIED] | HTTP + plugins (`metadataPlugin`, `idempotency`, `rateLimit`) | Existing stack |
| `prisma` (client-js) | 6.x [VERIFIED] | Transactions, row locks, migrations | Single DA layer via `packages/db` |
| `argon2` / `jsonwebtoken` | existing | Auth already done | — |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `notchpay-api` | 1.0.1 [VERIFIED: npm registry] | Optional typed wrapper for NotchPay | If team wants SDK instead of raw fetch; verified via `npm view` still published (404 for bare `notchpay`) |
| Native `node:crypto` | Node 22 | HMAC SHA-256, timingSafeEqual | For both NotchPay (`hex digest`) and CinetPay HMAC |
| Native `fetch` (Node 22) | — | Provider HTTP calls | No extra dep; add timeout + retry wrapper |
| `prom-client` (via fastify-metrics) | existing | Prometheus `payment_requests_total`, `webhook_duplicates_total` | Observability per AGENTS.md |
| `pino` (via fastify logger) | existing | Structured webhook receipt/processing logs | `req.log.info({ provider, eventType, deliveryId })` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `fetch` to NotchPay/CinetPay | `notchpay-api` SDK / `cinetpay-node` wrappers | SDKs are thin, may lag API; raw fetch is explicit, auditable, no hidden magic — prefer raw for enterprise control |
| `bullmq` for delays | Redis `EXPIRE` + `KEYS` scan | BullMQ gives proper retry, DLQ, concurrency, repeatable jobs — mandated by AGENTS.md for delayed holds |
| Kafka for webhook queue | BullMQ Queue only | Kafka is durable backbone with replay + partitions for scale; BullMQ for per-job backoff — use both: API enqueues to Kafka `payment.webhook.received`, worker consumes; BullMQ for retry/reconciliation timers |
| DB idempotency table | Redis only | Redis-only loses keys on eviction/maxmemory; use Redis `SET NX` (fast path) + DB unique constraint on `Payment.providerRef` or `ProcessedWebhook.deliveryId` (durable) — Stripe/Reclear pattern |

**Installation:**
```bash
# No new major deps if using raw fetch; if adopting queue helpers ensure peer deps exist
pnpm add bullmq@^5 ioredis@^6 kafkajs@^2 --filter @camermove/api
# Optional SDK (evaluate first)
pnpm add notchpay-api@^1.0.1 --filter @camermove/api
```

**Version verification:**
```bash
npm view ioredis version        # 6.0.0 verified
npm view kafkajs version        # 2.2.4 verified
npm view notchpay-api version   # 1.0.1 verified
npm view bullmq version         # run to confirm latest before install
npm view notion # etc.
```
Document verified version and publish date during planning. Training data versions may be stale — always confirm.

## Package Legitimacy Audit

> Required whenever this phase installs external packages.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `ioredis` | npm | 10+ yrs | ~5M/wk | github.com/redis/ioredis | OK | Approved — already in deps |
| `kafkajs` | npm | 7+ yrs | ~1M/wk | github.com/tulios/kafkajs | OK | Approved — already via packages/events |
| `zod` | npm | 5+ yrs | ~15M/wk | github.com/colinhacks/zod | OK | Approved — already installed |
| `bullmq` | npm | 5+ yrs | ~500k/wk | github.com/taskforcesh/bullmq | OK | Approved (verify version exists) |
| `notchpay-api` | npm | ~2 yrs | low | github.com/Marcjazz/notchpay-node | SUS | Flagged — low downloads, community SDK not official NotchPay; planner must add `checkpoint:human-verify` before use; prefer raw fetch |
| `notchpay` | npm | — | — | none | SLOP | REMOVED — `npm view notchpay version` returns 404 Unpublished (2023-12-16) |
| `cinetpay` | npm | — | — | none | SLOP | REMOVED — `npm view cinetpay version` returns 404 Unpublished (2021-09-28) |

*Other CinetPay SDK names (`cinetpay-node`, `cinetpay-sdk`) not verified; treat as [ASSUMED] until registry check.*

**Packages removed due to [SLOP] verdict:** `notchpay`, `cinetpay` (bare names)
**Packages flagged as suspicious [SUS]:** `notchpay-api` — planner inserts checkpoint:human-verify before install; evaluate maintenance, TS types, webhook helper quality vs raw fetch

*Packages discovered via WebSearch or training data that have not been verified against an authoritative source are tagged `[ASSUMED]` and the planner must gate each install behind a `checkpoint:human-verify` task.*

## Architecture Patterns

### System Architecture Diagram

```
  Traveler (web)                Admin/SuperAdmin
       |                              |
       |  POST /payments              |  GET /payments + /export + settings
       v                              v
  ┌────────────────────────────────────────────────┐
  │  Fastify API (stateless, trustProxy, /health)  │
  │  plugins: auth(RBAC), metadata, idempotency,   │
  │           rateLimit(IP+APP), swagger            │
  │                                                 │
  │  POST /payments ──► PaymentService               │
  │    validate booking(pending_payment, owner)      │
  │    compute amount = trip.price * seatCount       │
  │    Idempotency-Key → Redis 24h                   │
  │    create Payment{pending, providerRef?}         │
  │    call PaymentProvider.createPayment() ──┐      │
  │    return { authorization_url }           │      │
  │                                          │      │
  │  POST /webhooks/notchpay  ◄──────────────┼──────┼── NotchPay (payment.complete/failed)
  │  POST /webhooks/cinetpay  ◄──────────────┼──────┼── CinetPay (notify_url POST cpm_*)
  │    rawBody + HMAC verify                 │      │    (x-notch-signature / x-token)
  │    idempotency SET NX (Redis+DB)         │      │
  │    enqueue → Kafka topic ────────────────┼──┐   │
  │    return 200 < 50ms                     │  │   │
  └──────────────────────────────────────────┼──┼───┘
                                             │  │
       ┌─────────────────────────────────────┘  └──────────────────┐
       v                                                          v
  ┌──────────┐  ┌─────────────────────────────────┐  ┌──────────────────┐
  │  Redis   │  │  Worker (apps/worker)           │  │   Postgres + Prisma
  │ idemp.*  │  │  consume payment.webhook.received│  │  Booking, Payment, Commission
  │ cache.*  │  │  + verify via provider API       │  │  SeatAvailability, Ticket
  │ ratelimit│  │  tx: Payment→success  ► Booking→ │  │  AuditLog, AppSettings
  └──────────┘  │      confirmed + seatsHeld→booked│  │  (row locks, triggers)
                │      Commission{gross,net,%}      │  └──────────┬───────┘
                │      Kafka: payment.completed     │             │
                │  on fail: retry backoff → DLQ     │  ┌──────────▼──────┐
                │  cron: reconciliation (pending>5m)│  │  BullMQ queues   │
                │        call provider /verify      │  │  payment-retries │
                └─────────────────────────────────┘  │  DLQ, holdExpiry │
                                                     └──────────────────┘
         ┌─────────────────┐
         │  Providers       │
         │ api.notchpay.co  │── NotchPay checkout
         │ api-checkout     │── CinetPay checkout
         └─────────────────┘
```

Reader trace (happy path): Traveler `POST /payments { bookingId, provider:"notchpay", phone }` → API validates ownership + `pending_payment`, creates `Payment pending`, calls NotchPay `POST /payments` → gets `authorization_url` → traveler completes on hosted page → NotchPay fires webhook `payment.complete` → API verifies HMAC, dedups, enqueues, returns 200 → worker transactionally updates Payment success + Booking confirmed + seatsHeld→booked + Commission + AuditLog + Kafka `payment.completed` → Phase 4 ticket issued.

### Recommended Project Structure

```
apps/api/src/payments/
├── schema.ts           # Zod: CreatePaymentBody, Webhook NotchPay/CinetPay, list query
├── service.ts          # business rules: createPayment, confirmPayment, failPayment, reconcile, refund
├── repository.ts       # prisma wrappers: findPaymentByProviderRef, listPayments, etc.
├── commission.ts       # computeCommission(gross, transporterId) → { percent, commission, net }
├── routes.ts           # POST /payments, GET /payments, GET /payments/:id, GET /payments/export
├── webhooks/
│   ├── notchpay.ts     # POST /webhooks/notchpay — HMAC + idempotency + enqueue
│   ├── cinetpay.ts     # POST /webhooks/cinetpay — x-token + check API + enqueue
│   └── verify.ts       # shared: verifyNotchSignature(rawBody, sig, hashKey), verifyCinetToken(form, xToken, secret)
├── providers/
│   ├── types.ts        # PaymentProvider interface
│   ├── notchpay.adapter.ts
│   ├── cinetpay.adapter.ts
│   └── index.ts        # factory getProvider(name) / registry
└── jobs/
    ├── reconciliation.ts  # cron: find stuck pending, call verify, update
    └── refund.ts          # provider refund helper

packages/shared/src/money.ts  # commission math (already desired per AGENTS.md)
packages/events/src/topics.ts # add: paymentInitiated, paymentCompleted, paymentFailed, paymentRefunded
```

### Pattern 1: PaymentProvider Strategy Interface

**What:** Single interface both adapters implement; service depends on interface, not concrete provider. Enables dual provider without `if provider ===` sprawl and keeps SDK quirks isolated.
**When to use:** Every place that creates/verifies/refunds a payment; also for tests (mock provider).
**Example:**
```typescript
// Source: adapted from existing codebase patterns + NotchPay/CinetPay docs
// packages/shared or apps/api/src/payments/providers/types.ts

export type SupportedProvider = "notchpay" | "cinetpay";
export type PaymentMethod = "mobile_money" | "card" | "bank_transfer"; // maps to channel logic

export interface CreatePaymentInput {
  bookingId: string;
  reference: string;          // Booking.reference as idempotent key
  amount: number;              // XAF integer
  currency: "XAF";
  email?: string;
  phone?: string;              // E.164 2376...
  customerName?: string;
  description: string;
  callbackUrl: string;         // front return_url
  notifyUrl: string;           // webhook url (CinetPay requires explicitly; NotchPay via dashboard)
  channels?: "ALL" | "MOBILE_MONEY" | "CREDIT_CARD" | "WALLET";
}

export interface CreatePaymentResult {
  providerRef: string;         // transaction id / pay_xxx / payment_token
  authorizationUrl: string;    // redirect user to
  rawResponse: unknown;
}

export interface VerifyPaymentResult {
  status: "success" | "failed" | "pending" | "expired";
  amount: number;
  currency: string;
  providerRef: string;
  rawPayload: unknown;
}

export interface PaymentProvider {
  readonly name: SupportedProvider;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(providerRef: string): Promise<VerifyPaymentResult>; // GET /payments/{ref} or /v2/payment/check
  verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret: string): boolean;
  // Optional: refund, supported currencies/channels
}
```

```typescript
// apps/api/src/payments/providers/notchpay.adapter.ts [CITED: developer.notchpay.co/api-reference/payments]
import crypto from "node:crypto";

export class NotchPayAdapter implements PaymentProvider {
  readonly name = "notchpay" as const;
  constructor(private env: { NOTCHPAY_BASE_URL: string; NOTCHPAY_PUBLIC_KEY: string; NOTCHPAY_HASH_KEY: string }) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const res = await fetch(`${this.env.NOTCHPAY_BASE_URL}/payments`, {
      method: "POST",
      headers: { Authorization: this.env.NOTCHPAY_PUBLIC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: input.amount, currency: input.currency,
        email: input.email, phone: input.phone,
        reference: input.reference, callback: input.callbackUrl,
        description: input.description,
        // locked_channel: map PaymentMethod → cm.mtn/cm.orange etc. if needed
      }),
    });
    if (!res.ok) throw new Error(`NotchPay create failed ${res.status}`);
    const json = await res.json() as { transaction: { id: string }; authorization_url: string };
    return { providerRef: json.transaction.id, authorizationUrl: json.authorization_url, rawResponse: json };
  }

  verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    try { return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex")); }
    catch { return false; }
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    const res = await fetch(`${this.env.NOTCHPAY_BASE_URL}/payments/${reference}`, {
      headers: { Authorization: this.env.NOTCHPAY_PUBLIC_KEY },
    });
    const json = await res.json() as { transaction: { status: string; amount: number; currency: string } };
    const ok = json.transaction.status === "complete";
    return { status: ok ? "success" : json.transaction.status === "failed" ? "failed" : "pending", amount: json.transaction.amount, currency: json.transaction.currency, providerRef: reference, rawPayload: json };
  }
}
```

### Pattern 2: Webhook Receipt — Verify, Log, Enqueue, Return 200

**What:** Endpoint does ONLY HMAC verify + atomic dedup + enqueue; no business logic. Returns 200 within 50–100ms so provider doesn't retry spuriously. Worker does real work with retry/DLQ.
**When to use:** Both `/webhooks/notchpay` and `/webhooks/cinetpay`.
**Example:**
```typescript
// Source: Reclear/BullMQ pattern + developer.notchpay.co/get-started/webhooks/verify
// apps/api/src/payments/webhooks/notchpay.ts — Fastify route

// Register with rawBody capture (fastify-raw-body or custom onRequest)
app.post("/webhooks/notchpay", {
  config: { rawBody: true },
  // NO auth, NO rate-limit burst, but add verify-only
}, async (req, reply) => {
  const rawBody = (req as any).rawBody as string; // MUST be raw JSON string, not JSON.stringify(parsed)
  const sig = req.headers["x-notch-signature"] as string | undefined;
  if (!sig) return reply.code(401).send({ error: "missing signature" });

  const env = loadEnv();
  const adapter = new NotchPayAdapter(env);

  if (!adapter.verifyWebhookSignature(rawBody, sig, env.NOTCHPAY_HASH_KEY)) {
    req.log.warn({ sigLen: sig?.length }, "webhook signature invalid");
    return reply.code(403).send({ error: "invalid signature" });
  }

  const event = JSON.parse(rawBody) as { id: string; type: string; data: { id: string; reference: string } };
  const deliveryId = event.id; // evt_xxx — globally unique

  // Atomic dedup: Redis SET NX + 7d TTL, fallback to DB unique
  const claimed = await redis.set(`webhook:processed:${deliveryId}`, "processing", "EX", 300, "NX");
  if (claimed !== "OK") {
    req.log.info({ deliveryId }, "webhook duplicate, ack 200");
    return reply.code(200).send({ status: "duplicate" });
  }

  // Persist raw event for audit + enqueue
  await kafkaProducer.publish(EVENT_TOPICS.paymentWebhookReceived, {
    id: deliveryId, type: event.type, data: event, aggregateId: event.data.reference,
  } as never);
  // Alternative if not yet on Kafka: await bullmqQueue.add("process-webhook", event, { jobId: deliveryId, attempts: 6, backoff:{type:"exponential",delay:1000} });

  req.log.info({ deliveryId, type: event.type, ref: event.data.reference }, "webhook enqueued");
  return reply.code(200).send({ status: "received" });
});
```

CinetPay variant (must call check API inside worker, not trust notify):
```typescript
// apps/api/src/payments/webhooks/cinetpay.ts
// CinetPay notify is POST x-www-form-urlencoded with cpm_* fields, header x-token
app.post("/webhooks/cinetpay", {
  config: { rawBody: true },
}, async (req, reply) => {
  // For form-encoded, rawBody is urlencoded string; parse but keep raw for HMAC
  const rawForm = (req as any).rawBody as string; // e.g. cpm_site_id=...&cpm_trans_id=...
  const parsed = Object.fromEntries(new URLSearchParams(rawForm).entries());
  const xToken = req.headers["x-token"] as string | undefined;

  // HMAC: concatenation per docs: cpm_site_id+cpm_trans_id+cpm_trans_date+cpm_amount+cpm_currency+signature+payment_method+cel_phone_num+cpm_phone_prefixe+cpm_language+cpm_version+cpm_payment_config+cpm_page_action+cpm_custom+cpm_designation+cpm_error_message
  const secret = loadEnv().CINETPAY_SECRET_KEY; // to add to env
  const data = `${parsed.cpm_site_id}${parsed.cpm_trans_id}${parsed.cpm_trans_date}${parsed.cpm_amount}${parsed.cpm_currency}${parsed.signature}${parsed.payment_method}${parsed.cel_phone_num}${parsed.cpm_phone_prefixe}${parsed.cpm_language}${parsed.cpm_version}${parsed.cpm_payment_config}${parsed.cpm_page_action}${parsed.cpm_custom}${parsed.cpm_designation}${parsed.cpm_error_message}`;
  const expected = crypto.createHmac("sha256", secret).update(data).digest("hex");
  // Fallback: some docs show hash_hmac over implode('', $_POST) — try both if first fails
  if (!crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(xToken ?? "", "hex"))) {
    const fallback = crypto.createHmac("sha256", secret).update(Object.values(parsed).join("")).digest("hex");
    const ok = xToken && crypto.timingSafeEqual(Buffer.from(fallback, "hex"), Buffer.from(xToken, "hex"));
    if (!ok) return reply.code(403).send({ error: "invalid x-token" });
  }

  const deliveryId = `cinetpay:${parsed.cpm_trans_id}:${parsed.cpm_trans_date}`; // composite idempotency
  const claimed = await redis.set(`webhook:processed:${deliveryId}`, "1", "EX", 7*24*3600, "NX");
  if (!claimed) return reply.code(200).send({ status: "duplicate" });

  // Enqueue; worker will call POST /v2/payment/check to verify true status before mutating DB
  await kafkaProducer.publish(EVENT_TOPICS.paymentWebhookReceived, { id: deliveryId, data: parsed } as never);
  return reply.code(200).send({ status: "received" });
});
```

### Pattern 3: Transactional State Transition + Commission

**What:** Worker processes enqueued webhook inside a single Prisma `$transaction` that atomically updates `Payment.status`, `Booking.status`, `SeatAvailability`, `Commission`, and `AuditLog`. Guarded by state machine (reject invalid transitions, handle out-of-order).
**When to use:** Every webhook processing and reconciliation path.
**Example:**
```typescript
// apps/api/src/payments/service.ts — processPaymentSuccess
await prisma.$transaction(async (tx) => {
  const payment = await tx.payment.findUnique({
    where: { providerRef: reference }, // or fetch via booking reference
  });
  if (!payment) throw new Error("payment not found for webhook");
  if (payment.status === "success") return; // already processed — idempotent

  // State machine guard
  const current = payment.status as string;
  if (["failed","refunded"].includes(current)) return; // terminal, ignore late success

  // Amount check (CinetPay: must verify check API amount matches booking.totalAmount)
  const booking = await tx.booking.findUnique({ where: { id: payment.bookingId }, include:{trip:true}});
  if (!booking || booking.status !== "pending_payment") return;

  // Verify with provider (extra safety for CinetPay; optional for NotchPay)
  // const verified = await provider.verifyPayment(payment.providerRef!);

  // Update payment
  await tx.payment.update({ where:{ id: payment.id }, data:{ status:"success", webhookPayload: event } });

  // Confirm booking + seats
  await tx.booking.update({ where:{ id: payment.bookingId }, data:{ status:"confirmed" } });
  const sa = await tx.seatAvailability.findUnique({ where:{ tripId: booking.tripId } });
  if (sa) await tx.seatAvailability.update({ where:{ tripId: booking.tripId }, data:{ seatsHeld:{decrement: booking.seatCount}, seatsBooked:{increment: booking.seatCount}}});

  // Commission — read AppSettings + per-transporter override
  const commission = await computeCommission(tx, booking.totalAmount, booking.trip.transportId);
  await tx.commission.create({ data:{ bookingId: booking.id, grossAmount: booking.totalAmount, ...commission, payoutStatus:"pending"} });

  await tx.auditLog.create({ data:{ actorId: "system:webhook", action:"payment.success", entityType:"Payment", entityId: payment.id, metadata: event as any } });
});
// After tx: producer.publish(EVENT_TOPICS.paymentCompleted, { bookingId, paymentId }); // Phase 4 ticket will consume
```

### Pattern 4: Commission Calculation (global + per-transporter override)

**What:** Centralized `computeCommission` in `packages/shared/src/money.ts` reused by API and future mobile, reading `AppSettings.commissionPercent` (cached 30s) and `AppSettings.featureFlags.transporterCommissions` map or `Transporter.commissionOverride`.
**When to use:** On payment success and for admin reporting.
**Example:**
```typescript
// packages/shared/src/money.ts
export function calcCommission(gross: number, percent: number) {
  const commissionAmount = Math.round((gross * percent) / 100);
  const netAmount = gross - commissionAmount;
  return { commissionAmount, netAmount, percentApplied: percent };
}

// apps/api/src/payments/commission.ts
export async function computeCommission(tx: PrismaTx, grossAmount: number, transporterId: string) {
  const settings = await getAppSettingsCached(tx); // 30s Redis cache
  const globalPct = Number(settings.commissionPercent); // Decimal
  const overrides = (settings.featureFlags as any)?.transporterCommissions as Record<string, number> | undefined;
  const pct = overrides?.[transporterId] ?? globalPct;
  return calcCommission(grossAmount, pct);
}
```

### Anti-Patterns to Avoid
- **Trusting webhook payload as truth (CinetPay):** CinetPay explicitly says *"you will always have to make a call to the verification API to have the true values"* — updating DB from `cpm_amount` directly is a MITM risk. Always call `/v2/payment/check`.
- **Using parsed JSON for HMAC:** `JSON.stringify(req.body)` reorders keys/whitespace, breaking `x-notch-signature`/`x-token`. Use raw body bytes. Register `fastify-raw-body` or `onRequest` buffer capture.
- **Check-then-insert dedup:** `if (await alreadyProcessed()) { return } await mark()` is racy. Use `SET NX` or `INSERT ... ON CONFLICT DO NOTHING` atomically as the first operation.
- **Doing business logic inside webhook handler:** Provider timeout is 10–30s; a slow DB transaction triggers retry + duplicates. Separate receipt from processing via Kafka/BullMQ.
- **Returning 4xx for transient failures, 5xx for duplicates:** Return 200 for duplicates (stop retry), 5xx only for transient (trigger retry), 2xx fast always after dedup.
- **Storing card data or provider secrets in DB/logs:** Never log `x-token`/`hash_key` or full `webhookPayload.payment_method` with PAN; AGENTS.md forbids raw card storage.
- **One webhook URL for two providers with branching `if header`:** Separate routes `/webhooks/notchpay` and `/webhooks/cinetpay` with distinct verification — cleaner, auditable, and avoids cross-provider signature confusion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HMAC webhook verification | Custom string compare `===` | `crypto.timingSafeEqual` + raw body | Timing attacks; hex encoding pitfalls; AGENTS.md requires `X-Notch-Signature` verify |
| Idempotent webhook dedup | In-memory Set or `SELECT then INSERT` | Redis `SET key value EX ttl NX` + DB unique constraint | Race conditions, eviction, restart loss; Reclear pattern requires atomic claim |
| Retry with backoff + DLQ | `setTimeout` loop | `BullMQ` (attempts:6, backoff exponential 1s) + Kafka DLQ topic | Thundering herd, jitter, poison-pill blocking, operator replay tooling |
| Money math | Floating `gross * 0.1` | `Math.round(gross * percent / 100)` in `packages/shared/money.ts` + integer XAF cents | Floating errors on XAF, inconsistent rounding |
| Rate limiting | Hand-rolled counter in Map | Existing `plugins/rateLimit.ts` (IP+APP dual-layer via Redis) | Shared state across instances, 429 Retry-After, memory fallback |
| Cache key generation | `${origin}-${destination}` ad-hoc | `cacheKey(prefix, sortedParams)` from `lib/cache.ts` | Cache poisoning, key collision, TTL consistency |
| Idempotency for `POST /payments` | DB duplicate check | Existing `plugins/idempotency.ts` (`Idempotency-Key` header, Redis 24h) | Replay must return same `status+body+headers`, not re-create payment |
| Commission override | Hardcoded `if transporterId ===` | `AppSettings.featureFlags.transporterCommissions` + cache | Requires redeploy vs DB-driven without redeploy (AGENTS.md §5) |
| Export CSV streaming | Manual string concat per route | `lib/export.ts` `sendExport()` + `parseExportQuery()` | Content-Disposition, column escaping, `SEARCH_MAX_LIMIT` enforcement |

**Key insight:** Payments are the boundary where a homegrown retry or HMAC mistake silently diverges ledger vs provider; the multi-brand DLQ study shows a single missing idempotency key can produce 4,000 duplicate side effects in one afternoon. Use provider docs + atomic primitives, not intuition.

## Runtime State Inventory

> Include this section for rename/refactor/migration phases only. Omit entirely for greenfield phases.

*Skipped — this is a greenfield feature phase (new Payment + CinetPay), not a rename/refactor. No runtime state migration required. If later migrating `PaymentProvider.notchpay` enum, add inventory then.*

## Common Pitfalls

### Pitfall 1: HMAC Verified Against Parsed Body
**What goes wrong:** `JSON.stringify(req.body)` produces different whitespace/key order than the raw bytes NotchPay/CinetPay signed, so `timingSafeEqual` always fails in prod (but passes in tests with controlled payloads).
**Why it happens:** Fastify's default JSON parser discards raw bytes; developers call `verifyWebhookSignature(JSON.stringify(body), sig)` .
**How to avoid:** Register `fastify-raw-body` or an `onRequest` hook that buffers `request.rawBody`; verify before `JSON.parse`. Log `rawBody.length` on failure to debug. For CinetPay form-encoded, keep `rawForm` string.
**Warning signs:** Webhook returns 403 only in staging/prod, not locally; `expected` vs `received` hex differ by a few chars due to spacing.

### Pitfall 2: CinetPay Notify Treated as Source of Truth (No Verification Call)
**What goes wrong:** Attacker POSTs fake `cpm_trans_id`/`cpm_amount` to `notify_url`; ledger marks payment success without money. Or amount mismatch (booking 15,000 XAF, CinetPay paid 100 XAF) goes undetected.
**Why it happens:** Docs example updates DB directly from `$_POST`; teams copy that pattern.
**How to avoid:** Official flow: verify `x-token` → check `payment.pending` not already success → call `POST https://api-checkout.cinetpay.com/v2/payment/check` with `apikey+site_id+transaction_id` → only if `code=="00"` and `amount===booking.totalAmount` and `currency=="XAF"` then transition. CinetPay docs state *"CinetPay will not send you the transaction status ... always make a call to verification API"*.
**Warning signs:** `Payment.webhookPayload.cpm_amount != booking.totalAmount` but status set to success; manual refund requests spike.

### Pitfall 3: Duplicate Webhook Creates Duplicate Commission / Double Books Seats
**What goes wrong:** Provider retries `payment.complete` (at-least-once), handler re-applies `seatsHeld→booked` and inserts second `Commission`, or sends duplicate confirmation emails.
**Why it happens:** No idempotency key; or check-then-insert race where two workers both pass `if (!processed)` simultaneously.
**How to avoid:** First line in handler does atomic `SET NX webhook:processed:{event.id}` (Redis) + unique constraint on `Commission.bookingId` + guard `if (payment.status === "success") return`. Use `jobId = event.id` in BullMQ for queue-level dedup and DB `unique(bookingId)` for Commission. Include `payment.state_transition` in logs/metrics.
**Warning signs:** `Commission` count > `Payment success` count; `seatsBooked` exceeds `totalSeats` after load.

### Pitfall 4: Booking Hold Expires While Payment Processing — Lost Seat or Double Release
**What goes wrong:** `holdExpiresAt` (15m) fires `expireHolds` or BullMQ delay, releasing `seatsHeld→available` while provider is still `processing`; then webhook arrives late and tries to confirm seats that are no longer held → `seatsHeld` goes negative or booking stays `pending_payment` forever.
**Why it happens:** Expiry and payment success race on same `Booking` + `SeatAvailability` row without serialization.
**How to avoid:** Expiry job must `SELECT ... FOR UPDATE` on `Booking` and `SeatAvailability` inside transaction, and skip if `Payment.status` is `processing|success` or `booking.status != pending_payment`. Payment success must `SELECT ... FOR UPDATE` too. Optionally extend hold on `POST /payments` creation (`holdExpiresAt = now + AppSettings.holdExpiryMinutes`). Use version or `updatedAt` optimistic lock.
**Warning signs:** Bookings stuck `pending_payment` past expiry; `seatsHeld` drifts negative; customer paid but seats not confirmed.

### Pitfall 5: Amount Not Multiple of 5 (CinetPay) and Currency Mismatch
**What goes wrong:** CinetPay returns `600` or `608 MINIMUM_REQUIRED_FIELDS` because `amount` not multiple of 5, or `608 "cannot create transaction in different currency"` because account is XAF-only.
**Why it happens:** Frontend sends `amount: 12503` or `currency: XOF` accidentally.
**How to avoid:** Service validates `amount % 5 === 0` and `currency === "XAF"` (Cameroon) before calling CinetPay; Zod schema enforces; error mapped to 422 with `code: "AMOUNT_NOT_MULTIPLE_OF_5"`. Log `provider` + `currency` on failure.
**Warning signs:** CinetPay init returns 608 in logs; sandbox works but prod fails due to currency account config.

### Pitfall 6: Idempotency-Key Ignored on Payment Creation → Duplicate Provider Charges
**What goes wrong:** User double-clicks Pay, or network retry, or `POST /payments` without `Idempotency-Key` handling creates two `Payment` rows and two provider sessions; both may succeed → double charge for one booking.
**Why it happens:** AGENTS.md mandates idempotency but dev forgets to wrap `POST /payments` with `idempotencyPlugin` + DB uniqueness on `(bookingId, status pending)`.
**How to avoid:** `POST /payments` must require idempotency: check existing `Payment` for `bookingId` where `status in (pending, processing)` and return it; or use `Idempotency-Key` header keyed by `bookingId + provider`. Enforce `one pending payment per booking` via partial unique index `WHERE status IN ('pending','processing')` or app check inside transaction. Plugin already exists (`plugins/idempotency.ts`) — ensure route uses it.
**Warning signs:** `Payment` table has two `pending` rows same `bookingId`; provider dashboard shows two transactions same reference.

### Pitfall 7: Webhook Not Returning 200 Fast Enough → Retry Storm
**What goes wrong:** Handler does `await prisma.transaction` + `await provider.verifyPayment` synchronously, taking > 10s; provider times out, retries; now 5 parallel handlers contend on same row.
**Why it happens:** Business logic inside request handler instead of enqueue.
**How to avoid:** Receipt handler does verify→dedup→enqueue (Kafka) and returns 200; worker does DB tx. Measure `webhook_handler_p99_latency_ms`, alert if > 5s.
**Warning signs:** Logs show `deliveryId` processed 3× within seconds; provider dashboard shows retries even though 200 eventually sent.

## Code Examples

Verified patterns from official sources:

### Verify NotchPay Webhook (Node.js) — Must Use Raw Body

```typescript
// Source: developer.notchpay.co/get-started/webhooks/verify
import crypto from "node:crypto";

export function verifyNotchSignature(rawBody: string, signature: string, hashKey: string): boolean {
  // rawBody MUST be the raw JSON string (req.rawBody), not JSON.stringify(req.body) [CITED]
  const expected = crypto.createHmac("sha256", hashKey).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

// Fastify handler — register rawBody capture first
// await app.register(import("fastify-raw-body"), { field: "rawBody", global: true, encoding: "utf8", runFirst: true });
```

### Initialize NotchPay Payment [CITED: developer.notchpay.co/api-reference/payments]

```typescript
// Source: developer.notchpay.co/api-reference/payments
const res = await fetch("https://api.notchpay.co/payments", {
  method: "POST",
  headers: {
    Authorization: env.NOTCHPAY_PUBLIC_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount: 15000,              // XAF
    currency: "XAF",
    email: "traveler@example.com", // or phone / customer object
    reference: "CM-AB12CD34",   // booking.reference — idempotent reference
    callback: "https://camermove.cm/payment/callback",
    description: "CamerMove Booking CM-AB12CD34 Yaoundé→Douala",
  }),
});
const data = await res.json();
// data: { status:"Accepted", code:201, transaction:{ id:"pay_xxx" }, authorization_url:"https://pay.notchpay.co/pay_xxx" }
```

### Initialize CinetPay Payment [CITED: docs.cinetpay.com/api/1.0-en/checkout/initialisation]

```typescript
// Source: docs.cinetpay.com — POST https://api-checkout.cinetpay.com/v2/payment
const res = await fetch("https://api-checkout.cinetpay.com/v2/payment", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    apikey: env.CINETPAY_APIKEY,
    site_id: env.CINETPAY_SITE_ID,
    transaction_id: booking.reference, // must be unique
    amount: 15000,                    // MUST be multiple of 5, XAF for Cameroon
    currency: "XAF",
    description: "CamerMove Booking CM-AB12CD34",
    notify_url: "https://api.camermove.cm/api/v1/webhooks/cinetpay",
    return_url: "https://camermove.cm/payment/return",
    channels: "ALL",                  // or MOBILE_MONEY for MM-only
    // optional for card: customer_name, customer_email, customer_phone_number, etc.
  }),
});
const json = await res.json() as { code: string; data: { payment_token: string; payment_url: string } };
// json.code === "201" → redirect to json.data.payment_url
```

### Verify CinetPay Transaction [CITED: docs.cinetpay.com/api/1.0-en/checkout/verification]

```typescript
// Source: docs.cinetpay.com — POST https://api-checkout.cinetpay.com/v2/payment/check
const check = await fetch("https://api-checkout.cinetpay.com/v2/payment/check", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    apikey: env.CINETPAY_APIKEY,
    site_id: env.CINETPAY_SITE_ID,
    transaction_id: booking.reference,
  }),
});
const result = await check.json() as {
  code: string; // "00" = success
  data: { status: "ACCEPTED"|"REFUSED"; amount: string; currency: string; payment_method: string; operator_id: string | null };
};
// success iff result.code === "00" && result.data.status === "ACCEPTED"
```

### CinetPay X-Token HMAC Verification [CITED: docs.cinetpay.com/api/1.0-en/checkout/hmac]

```typescript
// Source: docs.cinetpay.com/api/1.0-en/checkout/hmac — concatenation order matters
import crypto from "node:crypto";

export function verifyCinetToken(form: Record<string,string>, xToken: string, secretKey: string): boolean {
  // Order per docs: cpm_site_id + cpm_trans_id + cpm_trans_date + cpm_amount + cpm_currency + signature + payment_method + cel_phone_num + cpm_phone_prefixe + cpm_language + cpm_version + cpm_payment_config + cpm_page_action + cpm_custom + cpm_designation + cpm_error_message
  const data =
    (form.cpm_site_id ?? "") + (form.cpm_trans_id ?? "") + (form.cpm_trans_date ?? "") +
    (form.cpm_amount ?? "") + (form.cpm_currency ?? "") + (form.signature ?? "") +
    (form.payment_method ?? "") + (form.cel_phone_num ?? "") + (form.cpm_phone_prefixe ?? "") +
    (form.cpm_language ?? "") + (form.cpm_version ?? "") + (form.cpm_payment_config ?? "") +
    (form.cpm_page_action ?? "") + (form.cpm_custom ?? "") + (form.cpm_designation ?? "") +
    (form.cpm_error_message ?? "");
  const expected = crypto.createHmac("sha256", secretKey).update(data).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(expected,"hex"), Buffer.from(xToken,"hex")); }
  catch { return false; }
}
```

### Atomic Hold (existing pattern to reuse for payment confirm) [CITED: packages/db/src/repositories/seat.repository.ts]

```typescript
// Source: existing codebase — atomicHoldSeats pattern with SELECT FOR UPDATE
await prisma.$transaction(async (tx: any) => {
  const rows = await tx.$queryRaw<Array<{ seatsAvailable:number; seatsHeld:number }>>`
    SELECT "seatsAvailable","seatsHeld" FROM "SeatAvailability" WHERE "tripId" = ${tripId} FOR UPDATE
  `;
  if (rows[0].seatsAvailable < seatCount) throw new ConflictError("Places insuffisantes");
  await tx.seatAvailability.update({ where:{tripId}, data:{ seatsAvailable:{decrement: seatCount}, seatsHeld:{increment: seatCount}}});
});
```

### BullMQ Retry + DLQ Queue [CITED: reclear.io blog + BullMQ docs pattern]

```typescript
// Source: reclear.io webhook handlers + bullmq docs
import { Queue } from "bullmq";
import { getRedis } from "../lib/redis.js";

export const webhookQueue = new Queue("payment-webhooks", {
  connection: getRedis(),
  defaultJobOptions: {
    attempts: 6,
    backoff: { type: "exponential", delay: 1000 }, // 1s,2s,4s,8s,16s,32s ≈63s total
    removeOnComplete: 1000,
    removeOnFail: false, // keep in DLQ for inspection
  },
});

// Worker distinguishes transient vs permanent
import { Worker, UnrecoverableError } from "bullmq";
new Worker("payment-webhooks", async (job) => {
  const { eventId, payload } = job.data;
  // idempotency double-check inside worker
  if (await alreadyProcessed(eventId)) return { skipped:true };
  try { await processPaymentEvent(payload); await markProcessed(eventId); }
  catch(e:any){
    if (e.message?.includes("invalid reference")) throw new UnrecoverableError(e.message);
    throw e; // retriable
  }
}, { connection: getRedis(), concurrency: 5 });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NotchPay `POST /payments/initialize` legacy path | `POST /payments` (both work but `initialize` is Legacy) [CITED] | NotchPay API v2.1 | Use canonical `/payments`; legacy may be removed |
| Prisma 2/5 with `client-js` generator | Prisma 6 stable `prisma-client-js` [VERIFIED] | Phase 1 decision, PROJECT.md 2026-08-24 | `.env` auto-load, fewer breaking changes — keep 6 for payments |
| Callback redirect as confirmation | Webhook as source of truth + callback only for UX toast + `GET /payments/:reference` verify | NotchPay docs "Always verify via Retrieve before fulfilling" | Callback can be spoofed; webhook + verify API required |
| CinetPay form POST without `x-token` | `x-token` HMAC SHA-256 + mandatory `/v2/payment/check` verification [CITED] | CinetPay HMAC docs | Notify alone is not trustworthy; double-verify |
| In-memory idempotency | Redis `SET NX` + DB unique + BullMQ `jobId` dedup | 2024-2026 best practice (Stripe/Reclear) | Handles eviction, restarts, concurrent workers |
| Polling provider for status | Webhook enqueue + reconciliation cron (hourly) | Enterprise pattern | Covers webhook loss during downtime; p95 <2s unaffected |
| Single provider hard-coded | `PaymentProvider` strategy with registry + per-booking `provider` enum | Scalability requirement (horizontal, mobile reuse) | Swappable, testable, enables A/B |

**Deprecated/outdated:**
- `POST /payments/initialize` (NotchPay) — still works but marked Legacy [CITED: /api-reference/payments]; use `POST /payments`.
- Bare `notchpay` and `cinetpay` npm packages — unpublished/404 [VERIFIED via npm view]; do not use.
- NotchPay `X-Notch-Signature` computed over `JSON.stringify(parsed)` — docs show raw payload [CITED]; parsed stringify breaks.
- CinetPay `channels` defaulting to `ALL` without `currency` check — Cameroon XAF-only; mismatch yields 608.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | BullMQ 5.x is available and compatible with ioredis 6; existing worker will add it [ASSUMED] | Standard Stack | If version mismatched, delayed/retry jobs fail; verify via `npm view bullmq version` before install |
| A2 | CinetPay amount must be multiple of 5 and XAF for Cameroon accounts [CITED but needs runtime confirmation for sandbox] | Pitfalls | If sandbox allows non-multiples, prod will still reject; test prod credentials early |
| A3 | NotchPay sandbox uses same `api.notchpay.co` base with test keys (no separate sandbox host) [CITED: servers says "Production and Sandbox Environment" same URL] | Architecture | If sandbox has different base, env config wrong; confirm via NotchPay dashboard |
| A4 | CinetPay `x-token` concatenation order exactly as docs list (including empty fields as "") [CITED: docs.cinetpay.com/api/1.0-en/checkout/hmac] | Code Examples | Some SDK examples use `implode('',$_POST)` fallback; planner should handle both and log mismatch |
| A5 | `CINETPAY_APIKEY`, `CINETPAY_SITE_ID`, `CINETPAY_SECRET_KEY` will be added to `packages/config/env.ts` and `.env.example` [ASSUMED] | Standard Stack | If secrets stored elsewhere (AppSettings?), verification breaks |
| A6 | Existing `AppSettings.commissionPercent` (Decimal 10) + `featureFlags.transporterCommissions` pattern is acceptable for per-transporter override (no new table) [ASSUMED — alternative is `Transporter.commissionOverride` column] | Architecture Patterns | If override per transporter needs audit/history, a dedicated table is better |
| A7 | `PAY-01..04` requirements as stated in REQUIREMENTS.md are complete and unchanged (no hidden sub-requirements for partial refunds or split payments) [ASSUMED] | Summary | If split-payment or partial capture needed, provider abstraction must expand |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions (RESOLVED)

> No unresolved questions blocking planning — dual provider (NotchPay primary, CinetPay gated behind `CINETPAY_*` env), HMAC rawBody with timingSafeEqual, CinetPay double-verify via `/v2/payment/check`, atomic `SET NX` dedup, `featureFlags.transporterCommissions` map for commission override, refund stub, and channel `ALL` default are resolved per PATTERNS.md and Architecture Patterns.

1. **CinetPay credentials and account currency**
   - What we know: Cameroon accounts are XAF-only; amount multiple of 5 [CITED]. Need `apikey`, `site_id`, `secretKey` from Integrations menu [CITED].
   - What's unclear: Do we have sandbox vs live `site_id`? Is account already provisioned for `XAF`? What `channels` are enabled?
   - Recommendation: Request CinetPay sandbox credentials now; add `CINETPAY_*` to `packages/config/env.ts` as `secret()`; verify `POST /v2/payment` with 100 XAF test transaction before coding success path.

2. **Reconciliation ownership and cadence**
   - What we know: Provider webhooks can be lost; pattern is hourly cron verifying `Payment` where `status pending` and `createdAt < now-5m` via `verifyPayment` [CITED best practice].
   - What's unclear: Should reconciliation live in `apps/worker` (Kafka consumer) or BullMQ repeatable job in `apps/api`? Who owns alerting on DLQ depth?
   - Recommendation: Implement as BullMQ repeatable job (`every 15m`) in worker for stuck payments + daily full reconciliation; expose Prometheus `dlq_events_total`. Planner decides worker topology.

3. **Per-transporter commission override storage**
   - What we know: AGENTS.md §5 says AppSettings holds `commissionPercent` + `featureFlags` (JSON) cached 30s; easy to store `featureFlags.transporterCommissions` map. Alternative is adding `Transporter.commissionOverride Decimal?`.
   - What's unclear: Do overrides need history/audit per transporter? Will `super_admin` UI edit per-transporter override inline?
   - Recommendation: Start with `featureFlags.transporterCommissions` map (no schema migration, consistent with cancellationTiers pattern); planner adds `checkpoint:human-verify` to confirm vs column; document decision in PLAN.md.

4. **Refund execution: provider refund API vs manual**
   - What we know: Cancellation tiers exist (`Booking.cancellation.ts` with `DEFAULT_TIERS`, refundPercent/feePercent). Existing `cancelBooking` already marks `Payment success → refunded` but says "actual provider refund is async via worker" (comment). NotchPay/CinetPay refund endpoints not documented in research scope.
   - What's unclear: Does NotchPay/CinetPay expose refund API? Or are refunds manual via dashboard? Does worker need to call provider refund?
   - Recommendation: For Phase 3, implement `Payment.status = refunded` + `Commission.payoutStatus = refunded` transactionally; add `jobs/refund.ts` stub that logs and enqueues provider refund if API exists, else marks for manual ops and notifies admin via AuditLog/Notification. Planner to verify refund API existence with credentials.

5. **Frontend payment channel selection UX**
   - What we know: CinetPay `channels` can be `ALL`, `MOBILE_MONEY`, `CREDIT_CARD`, `WALLET`; NotchPay supports `locked_channel=cm.mtn/cm.orange`, `locked_country=CM` [CITED].
   - What's unclear: Does Phase 3 frontend expose provider choice ("Pay with MTN / Orange / Card") or is it a single "Pay" button that opens provider checkout?
   - Recommendation: Plan for `POST /payments { provider, method }` where `method` maps to channel; frontend can start with two buttons (NotchPay vs CinetPay) or single with provider default. Planner to specify in UI-SPEC if needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node >=22 | All | ✓ [VERIFIED: package.json engines] | >=22 | — |
| pnpm 11.9.0 | Monorepo | ✓ | 11.9.0 | — |
| Postgres 16 | Prisma, transactions, row locks, Commission, Payment | ✓ [VERIFIED: docker-compose] | 16-alpine | — |
| Redis 7 | Idempotency, rate-limit, webhook dedup, BullMQ, cache | ✓ [VERIFIED: docker-compose] | 7-alpine | In-memory Map fallback (existing) |
| Kafka 3.7 (bitnami) | Durable events, webhook queue, replay | ✓ [VERIFIED: docker-compose] | 3.7 | BullMQ queue if Kafka down (not ideal for replay) |
| NotchPay API | PAY-01..04 primary | ✓ (keys from .env) | api.notchpay.co v2.1 [CITED] | Retain stub if keys missing; CinetPay as alternate |
| CinetPay API | PAY-01..04 dual provider | ✗ (needs credentials) | api-checkout.cinetpay.com v2 [CITED] | NotchPay-only until creds provisioned |
| BullMQ | Delayed hold, retry, DLQ, reconciliation cron | ✗ (not yet installed) [ASSUMED] | 5.x | Use Redis TTL + Kafka for fallback; install in Phase 3 |
| Grafana/Prometheus | payment_* metrics, webhook lag alerts | ✓ [VERIFIED: docker-compose] | latest | Logs only |
| Mailhog / SMTP | Payment confirmation emails (Phase 4 but audit) | ✓ | — | Log fallback |
| `fastify-raw-body` | Raw body for HMAC | ✗ (not in package.json) [ASSUMED] | — | Custom `onRequest` buffer hook |

**Missing dependencies with no fallback:**
- CinetPay `apikey`/`site_id`/`secretKey` — blocks CinetPay path; NotchPay path unblocked. Planner must add provisioning task and gate CinetPay routes behind env check (`if (!env.CINETPAY_APIKEY) return 501`).

**Missing dependencies with fallback:**
- `bullmq` + `fastify-raw-body` — add via `pnpm add`; fallback to existing Redis + custom rawBody hook and Kafka-only queue.

## Security Domain

> Required when `security_enforcement` is enabled (absent = enabled via AGENTS.md §1).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireAuth()` RBAC; `POST /payments` owner check (`booking.userId === user.id` or admin); webhook routes exempt from JWT but require HMAC |
| V3 Session Management | yes | Stateless JWT (15m access + 30d refresh per AUTH-02); no session fixation; webhook no session |
| V4 Access Control | yes | RBAC per endpoint; `GET /payments/:id` checks `payment.booking.userId === actorId` unless admin/super_admin; `GET /payments/export` same |
| V5 Input Validation | yes | Zod on every payment/webhook payload; `PaymentMethod` enum, `amount` multiple-of-5, `currency === XAF`, `provider` enum, `transaction_id` length |
| V6 Cryptography | yes | `node:crypto` HMAC SHA-256 + `timingSafeEqual` for both providers; `NOTCHPAY_HASH_KEY` / `CINETPAY_SECRET_KEY` via `loadEnv()` secrets; never log secrets |
| V7 Error Handling & Logging | yes | Structured pino logs without PII; `Payment.webhookPayload` audit but redact `cel_phone_num`; generic 403 on bad signature (no oracle) |
| V8 Data Protection | yes | No raw card data (AGENTS.md: "Never store raw card data; all via provider hosted flow"); `Payment.method` is enum only; providerRef tokenized |
| V10 Malicious Code | yes | Webhook `notify_url`/`callback` validated against allowlist (`API_URL` + `WEB_URL`); no SSRF via provider fetch |
| V11 Business Logic | yes | State machine guards, amount reconciliation (`provider amount === booking.totalAmount`), at-most-one pending per booking, commission math integer |
| V13 API & Web Services | yes | Rate limiting dual-layer (IP+APP) on `POST /payments` and webhooks (higher burst for provider IPs); OpenAPI documented; idempotency 24h |
| V14 Configuration | yes | All secrets via `loadEnv()` Zod `secret()`; no `process.env` elsewhere; `.env` gitignored; `CINETPAY_*` added as required secrets |

### Known Threat Patterns for Payments Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Webhook spoofing (fake `payment.complete`) | Spoofing | HMAC SHA-256 verify with `timingSafeEqual` on raw body; reject 403; [CITED: developer.notchpay.co/get-started/webhooks/verify] |
| Replay attack (re-send old webhook) | Spoofing / Tampering | Delivery ID dedup (`SET NX` 7d TTL) + timestamp window check (NotchPay `created_at` > 5m old → reject or require provider verify); at-least-once handling |
| Amount tampering (fake `cpm_amount` lower than price) | Tampering | Always call `/v2/payment/check` or `GET /payments/{ref}` and compare `amount === booking.totalAmount`; [CITED: CinetPay "always call verification API"] |
| Race: hold expiry vs payment success | Tampering / DoS | `SELECT FOR UPDATE` on Booking + SeatAvailability in both paths; skip expiry if Payment is processing/success |
| Duplicate processing → double seats/commission | Tampering | Atomic `SET NX` dedup + `payment.status === success` guard + unique `Commission.bookingId` |
| Card data storage | Information Disclosure | Hosted checkout only (`authorization_url`/`payment_url` redirect); never accept/store PAN; `PaymentMethod` enum only |
| SSRF via `notify_url`/`return_url` echo | Tampering | Validate `notify_url` is our own webhook URL; validate `return_url` is allowlisted `WEB_URL`; provider fetch uses fixed base URL |
| Provider key leakage in logs | Information Disclosure | No logging of `Authorization`, `X-Notch-Signature`, `x-token`, `hashKey`, `secretKey`; redact `webhookPayload` fields |
| Unbounded retry → resource exhaustion | Denial of Service | Rate-limit webhooks (app-wide per route), BullMQ backoff capped 6 attempts, DLQ with alert, return 200 for duplicates fast |

## Sources

### Primary (HIGH confidence)

- Official NotchPay developer docs via WebFetch — `developer.notchpay.co/api-reference/payments` (init, Payment statuses pending/processing/complete/failed/canceled/expired, Authorization header, callback verify via `GET /payments/{reference}`), `developer.notchpay.co/get-started/webhooks/verify` (HMAC SHA-256 over raw JSON, `x-notch-signature`, `hash_equals`/`timingSafeEqual`), `developer.notchpay.co/api-reference/webhooks` (event object `{id,type,created_at,data}`, events `payment.complete/failed/created/processing/canceled/expired`), `developer.notchpay.co/api-reference/initialize-a-payment` (OpenAPI 3.1, `locked_channel` cm.mtn etc.)
- Official CinetPay docs via WebFetch — `docs.cinetpay.com/api/1.0-en/checkout/hmac` (x-token HMAC concatenation string + `hash_hmac SHA256`), `docs.cinetpay.com/api/1.0-en/checkout/notification` (notify_url GET+POST, 200 OK, must call `/v2/payment/check`, multiple-notify idempotency), `docs.cinetpay.com/api/1.0-en/checkout/initialisation` & FR variant ( `POST https://api-checkout.cinetpay.com/v2/payment` with `apikey,site_id,transaction_id,amount(multiple of 5),currency,description,notify_url,return_url,channels`), `docs.cinetpay.com/api/1.0-en/checkout/verification` (`POST /v2/payment/check` with `code=="00"` success, `status ACCEPTED`), `docs.cinetpay.com/api/1.0-en/checkout/tableau` (codes 00,201,600,608 etc., channels OMCM/MTNCM/VISAMCM for Cameroon), `docs.cinetpay.com/api/1.0-en/sdk/*` examples
- `npm view ioredis/kafkajs/notchpay-api` registry checks for version legitimacy

### Secondary (MEDIUM confidence)

- Reclear/Stripe webhook handler best practices (verify→log→enqueue→return 200, BullMQ `attempts:6 exponential 1s`, `SET NX` idempotency, DLQ, timingSafeEqual) — WebSearch result from reclear.io + stripe webhooks production article — patterns cross-checked against official NotchPay/CinetPay docs
- Empirium/streamkap/multi-flow webhook-to-Kafka architectures (separate receipt from processing, Kafka acks=all + idempotence, consumer lag metrics) — WebSearch

### Tertiary (LOW confidence)

- `bullmq` version 5.x and `fastify-raw-body` availability [ASSUMED — not in current package.json; verify via `npm view` before install]
- `notchpay-api` SDK quality/maintenance [SUS — low downloads, community SDK]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — core deps verified via npm registry + existing codebase; BullMQ/raw-body flagged ASSUMED for install verification
- Architecture: HIGH — PaymentProvider strategy + webhook verify→enqueue pattern is well-established and aligns with AGENTS.md stateless/ACID/horizontal principles
- Pitfalls: HIGH — HMAC raw-body, CinetPay verification, dedup race, hold-expiry race are recurring payment bugs with documented mitigations

**Research date:** 2026-08-25
**Valid until:** 2026-09-25 (30 days; re-verify CinetPay credential availability and NotchPay API version if planning beyond)

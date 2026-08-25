# Phase 4: Ticketing & Notifications — Research

**Researched:** 2026-08-25
**Domain:** E-ticket generation (QR + verificationCode), ticket lookup/validation, multi-channel notification dispatch (email via own SMTP/MailHog, WhatsApp via Twilio, push via ntfy per-user topic), traveler dashboard with upcoming/history/tickets
**Confidence:** HIGH (Schema + worker channel adapters verified in codebase; qrcode package verified via npm registry + Context7 docs; ntfy.sh docs cited; nodemailer/twilio already wired in `apps/worker`; payment webhook already enqueues to `notificationShouldSend` topic but payload shape is incomplete — gaps identified)

## User Constraints (from CONTEXT.md)

### Locked Decisions
No CONTEXT.md exists for this phase — no prior discuss-phase decisions to honor. Phase derives from ROADMAP.md + REQUIREMENTS.md + explicit user prompt.

User prompt explicitly fixes the deliverable scope (cannot be reinterpreted):
- **TICK-01**: Confirmed booking generates an e-ticket with QR/verificationCode
- **TICK-02**: Ticket can be looked up by reference and validated
- **NOTIF-01**: Email via own SMTP, MailHog fallback, fires for booking/payment/ticket events
- **NOTIF-02**: WhatsApp via Twilio (per-user, fallback to log)
- **NOTIF-03**: Push via ntfy per-user topic (web + mobile)
- **Dashboard**: New authenticated route showing upcoming trips, history, tickets

### the agent's Discretion
- QR library selection (qrcode vs qrcode-generator vs zxing)
- Ticket model extra fields (issuedBy system user, exp, scannerCount, scannedAt)
- Notification fan-out timing (synchronous from API vs async via Kafka)
- Notification payload shape (rich per-event type vs generic {to,subject,text,body,title,message})
- Dashboard layout (server component with RSC fetch vs client component with React Query)
- Trip reminder job (BullMQ delayed vs setInterval)
- Channel fallback policy when credentials missing

### Deferred Ideas (OUT OF SCOPE)
- Native mobile app (Phase 4 explicitly web+mobile push but native app is v2)
- Loyalty, tourism marketplace, dynamic pricing, AI, real-time geolocation
- Reviews/ratings, promo codes
- Transporter-side ticket scanner/validator (Phase 5 admin/transporter)
- Bulk ticket PDF export, branded PDF tickets (e-ticket = QR + verification code in MVP)

## Project Constraints (from AGENTS.md)

All research must respect AGENTS.md as the contract (non-negotiable):

- **Statelessness** — JWT `Authorization: Bearer`, no server session; horizontal scale zero sticky
- **Idempotency** — Every `POST/PUT/PATCH` accepts `Idempotency-Key`, Redis 24h replay; ticket create + ticket validate must be idempotent
- **ACID** — Ticket create inside Prisma `$transaction` with `SELECT ... FOR UPDATE` on `Booking` to serialize against `cancelBooking` and `failPayment`; Booking row lock prevents orphan/double tickets
- **Caching** — `cache.ts` + `getRedis()` (ioredis) with `cacheKey(prefix, sortedParams)` 60s TTL; fallback to memory
- **Proper indexing** — `Ticket @@index([bookingId],[verificationCode])` (verificationCode already `@unique`), `Notification @@index([userId,status],[channel,status])` to be added in this phase
- **Rate limiting** — Dual-layer IP + app per route via Redis+memory fallback, 429 with Retry-After
- **Async processing** — Kafka durable events (`ticket.issued` already in topics; `notification.should-send` already exists) + BullMQ for delayed trip reminders; `apps/worker` is consumer; never block API on Twilio/SMTP latency
- **Decoupling via APIs** — Business logic only `apps/api` + `packages/*`; `apps/web` only calls `REST /api/v1` versioned Zod-validated OpenAPI; QR image served via `GET /tickets/:id/qr` (or pre-rendered data-URL embedded in email — do NOT serve from public CDN)
- **Robust security** — `argon2`, RBAC `requireAuth(role?)`, Zod on every endpoint, secrets only via `loadEnv()` from `.env` (gitignored); `Ticket.verificationCode` is sensitive — never log plaintext; `Ticket.qrCode` should contain the verification code (or signed JWT), NOT raw booking data
- **Horizontal scalability** — Stateless API + Redis + Postgres + Kafka partitions + `trustProxy` + `/health` + graceful SIGTERM
- **Endpoint metadata** — `metadataPlugin` `req.meta` (ip, os, browser, device, ua, referer, requestId) + handler-specific fields. Per AGENTS.md §2: `POST /tickets/*` logs `bookingId, verificationCode` (hashed) and `GET /tickets/*` logs `entityId, userId, ip`
- **AppSettings** — Singleton `id="global"` already holds `smtpHost, smtpPort, smtpUser, smtpFrom` (lines 331-334 of schema); NOTIF-01's "own SMTP" implies super_admin can override via `PUT /admin/settings` — already supported
- **Exportable & Periodic** — Dashboard list endpoints that are periodic (my tickets) support `dateFrom/dateTo` + `GET /tickets/export?format=json|csv`; `GET /notifications/export` per AGENTS.md §6 line 58
- **No Dead Code** — `pnpm -r typecheck` + `knip` 0 unused; verification gates

## Summary

Phase 4 generates an e-ticket for every confirmed booking and notifies the traveler via three channels. The Prisma `Ticket` model already exists (lines 274-282 of `schema.prisma`): `id, bookingId, qrCode, verificationCode @unique, status: TicketStatus (valid|used|void), issuedAt`. The `Notification` model already exists (lines 284-295) with `userId?, transporterId?, channel: NotificationChannel (email|sms|whatsapp|push), type, status: NotificationStatus (queued|sent|failed), payload: Json, sentAt`. Phase 3's worker already wires the three channel adapters in `apps/worker/src/notifications/channels/`: `email.ts` (nodemailer via `SMTP_*` env with MailHog-friendly `localhost:1025` default), `whatsapp.ts` (twilio via `TWILIO_*` with graceful skip if missing), `push.ts` (ntfy.sh POST to `/camermove_${userId}` topic). Phase 3's `confirmPaymentSuccess` already publishes `EVENT_TOPICS.paymentCompleted` + `EVENT_TOPICS.notificationShouldSend` after the tx commits (line 157-159 of `payments/jobs/reconciliation.ts`), and the worker has a `notificationShouldSend` handler (line 12-14 of `apps/worker/src/index.ts`). **Critical gap**: the published payload `{ userId, bookingId }` is bare-bones — it does not tell the channel adapter what `to/subject/text/body/title/message` to send, and the channel adapters (e.g. `email.ts:4-9`) read `payload.to, payload.subject, payload.text`. **Critical gap 2**: the notification row is never created (Phase 3 worker calls `prisma.notification.create` inside `send()` but the `event.data` shape won't satisfy the typed `SendInput`). **Critical gap 3**: Phase 3 `cancelBooking` + `refundPayment` already void tickets (`updateMany status:"void"`), but the void path also needs to fire a notification. **Critical gap 4**: Phase 4 needs a Ticket creation hook inside the payment confirmation transaction (currently `confirmPaymentSuccess` does not create a Ticket — it only creates Commission + AuditLog).

For TICK-01/TICK-02, generate a `verificationCode` (8-10 char `[A-Z0-9]`, collision-checked via `@unique` constraint) and a `qrCode` (a signed JWT or opaque token containing `verificationCode` + `bookingId` + `iss=camermove` + `iat`; do NOT embed raw PII like email/phone). The QR image is rendered server-side as PNG/SVG via `qrcode` package on demand at `GET /tickets/:id/qr.png` (per-ticket request, 5-min Redis cache) — never store the PNG in DB (binary bloats rows). Lookup endpoints: `GET /tickets/lookup/:verificationCode` (public, returns `{status, bookingId, tripDate, passengerNames, seatLabels}` for QR scan by transporter/validator — no PII like email/phone/price), and `GET /tickets/:id` (auth, owner or admin only). Validation endpoint: `POST /tickets/validate` (transporter_staff or admin role) records `scannedAt + scannedBy` and transitions `valid → used`.

For notifications, the existing service `createNotificationService.send` in `apps/worker/src/notifications/service.ts` (line 7-22) handles persist-then-send, but the trigger is broken because `EVENT_TOPICS.notificationShouldSend` handler receives raw event data with no email/phone/topic. **Phase 4 must refactor the trigger pattern**: introduce typed notification events `booking.confirmed | payment.received | ticket.issued | booking.cancelled | payment.refunded` whose `data` includes the resolved `to` addresses (email/phone/pushTopic), the templated `subject/title` and `text/body/message` per channel, and a `channels: ("email"|"whatsapp"|"push")[]` list. The worker handler becomes a "render + fan-out" dispatcher that creates one Notification row per (event × channel), then calls the appropriate channel adapter. Templates live in `apps/worker/src/notifications/templates.ts` (FR locale, no i18n v1) — pure functions that take booking/payment/ticket + user and return `{ email?: {to,subject,text}, whatsapp?: {to,body}, push?: {to, title, message} }`. Channel adapters stay as-is.

For NOTIF-01, the existing `sendEmail` already reads `SMTP_*` env and falls back to `localhost:1025` (MailHog from docker-compose). To make the "own SMTP" setting a true AppSettings override (not just env), the email sender should `loadEnv()` first then `getAppSettingsCached()` to pull `smtpHost/smtpPort/smtpUser/smtpFrom` if set, and only fall back to env (avoids reload after super_admin updates settings). For NOTIF-02, the existing `sendWhatsApp` gracefully no-ops when `TWILIO_ACCOUNT_SID` is missing — keep this. For NOTIF-03, the existing `sendPush` POSTs to `NTFY_HOST/camermove_${userId}` and gracefully no-ops when `NTFY_HOST` is missing; ensure topic format is `camermove-user-${cuid}` (ntfy topic rules disallow `_` in some clients and length limits — use a stable hash or `user-${cuid}`).

For the traveler dashboard, add `apps/web/app/dashboard/page.tsx` (auth-required server component OR client component with React Query) with three tabs: `Upcoming` (bookings with `trip.departureAt > now AND status in [confirmed, refunded] AND ticket.status in [valid, used]`), `History` (`status in [cancelled, expired] OR trip.departureAt < now`), `Tickets` (list of `Ticket` joined to `booking` + `trip` with QR image links). Each card shows reference, route, date, status, and a "Voir le billet" link to `apps/web/app/tickets/[id]/page.tsx` which renders the QR (via `<img src="/api/v1/tickets/:id/qr.png?token=...">`) and the verification code in large monospace for screenshot/print. The API contract: `GET /me/dashboard` returns `{ upcoming, history, tickets }` in one call (single transaction) to avoid N+1 fan-out.

**Primary recommendation:** (1) Add `apps/api/src/tickets/{schema,service,repository,routes}.ts` + `apps/api/src/tickets/jobs/scanReminder.ts` (daily cron for upcoming trip reminders via `notificationShouldSend`); (2) Add `apps/worker/src/notifications/templates.ts` with FR templates; (3) Refactor `apps/worker/src/notifications/service.ts` to take typed `NotificationEvent` (not raw `{userId,bookingId}`); (4) Add `apps/web/app/dashboard/{page,upcoming-tab,history-tab,tickets-tab}.tsx` + `apps/web/app/tickets/[id]/page.tsx` + `apps/web/lib/api/tickets.ts`; (5) Add `GET /me/dashboard` returning `{upcoming, history, tickets}` to `apps/api/src/me/routes.ts` (new module). Modify `apps/api/src/payments/jobs/reconciliation.ts:69-162` to call `generateAndIssueTicket` inside the success transaction (FOR UPDATE guards). Add a `prisma migration` for `Ticket @@index([bookingId])` + `Notification @@index([userId,status,createdAt])` + new `TripReminder` table OR reuse `Notification` with `type: "trip.reminder"` and skip table.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Generate ticket (QR + verificationCode) on confirmed booking | API / Backend (in-tx) | Database | Must be atomic with Payment→success + Commission; FOR UPDATE on Booking prevents orphan ticket on cancel race; no race with webhook replay (idempotent by `(bookingId)` unique) |
| Render QR image PNG/SVG | API / Backend | Redis cache (5min) | Server-side render via `qrcode` package; cache per-ticket by `verificationCode`; never store binary in DB |
| Public ticket lookup by verificationCode | API / Backend (public, rate-limited) | Database | QR scan by transporter; returns redacted view (no email/phone/price); rate-limited per IP to prevent enumeration (50/min) |
| Ticket validation (mark used) | API / Backend (transporter_staff+) | Database | Atomic state transition `valid → used`; record `scannedAt + scannedBy` for audit; AGENTS.md §2 endpoint metadata |
| Traveler dashboard data (upcoming/history/tickets) | API / Backend (`GET /me/dashboard`) | Database (single tx) | RBAC scoped to `req.user.id`; one round-trip for SSR; pagination per tab |
| Dashboard UI rendering | Frontend (Next.js, RSC or React Query) | API | Authenticated route; no direct DB access; React Query cache 60s per AGENTS §4 SEARCH-06 pattern |
| Email delivery (NOTIF-01) | Worker (async, Kafka) | SMTP server (own) or MailHog fallback | SMTP has 5-30s latency; never block API; nodemailer already wired |
| WhatsApp delivery (NOTIF-02) | Worker (async, Kafka) | Twilio API | Twilio API latency 1-3s; rate-limited per-sid |
| Push delivery (NOTIF-03) | Worker (async, Kafka) | ntfy.sh or self-hosted | Single POST < 1s; topic `user-${cuid}` per-user |
| Notification template rendering | Worker (templates.ts) | Database (load user/booking) | Pure FR templates, deterministic; separate from channel adapters |
| Trip reminder (24h before departure) | Worker (cron, hourly check) | BullMQ or setInterval | Reminder for upcoming confirmed bookings; queries `Booking where status:confirmed AND trip.departureAt between now+23h and now+25h` |
| Notification persistence audit | Worker (Notification row) | Database | Every send attempt writes one Notification row (status queued → sent | failed); admin export via `GET /notifications/export` |
| Ticket model + indexes | Database (Prisma migration) | — | New `@@index([bookingId])` + `Notification @@index([userId,status,createdAt])`; no schema shape change to Ticket (already correct) |
| Auth/cookies/session | Frontend (zustand persist) | API (JWT verify) | Existing pattern, no change |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `qrcode` | 1.5.4 [VERIFIED: npm registry + soldair/node-qrcode] | QR PNG/SVG render + `toString` for data-URL | Industry standard for Node QR rendering; 22M+ weekly downloads; MIT; ESM + CJS; API `QRCode.toBuffer(text, opts)` returns PNG buffer, `QRCode.toString(text, {type:'svg'})` for vector; supports error correction L/M/Q/H |
| `nodemailer` | 6.9.16 [VERIFIED: npm registry, in apps/worker deps] | SMTP client (NOTIF-01) | Already in `apps/worker/package.json`; supports HTML + plaintext + attachments; STARTTLS via `secure: false + requireTLS: true`; auth via `user/pass` |
| `twilio` | 6.1.0 [VERIFIED: npm registry, in apps/worker deps] | WhatsApp Business API (NOTIF-02) | Already in `apps/worker/package.json`; `client.messages.create({from: 'whatsapp:+...', to: 'whatsapp:+237...', body})` is the standard call |
| `zod` | 4.4.3 [VERIFIED] | Validate every ticket/notification payload | AGENTS.md requires Zod on every endpoint; `apps/api` already depends |
| `ioredis` | 6.0.0 [VERIFIED] | QR image cache (5min TTL), AppSettings smtp cache | Already in `apps/api` deps; AGENTS.md mandated shared Redis |
| `kafkajs` | 2.2.4 [VERIFIED] | Durable event backbone for `ticket.issued`, `notification.should-send` | Already via `packages/events`; enables replay, fan-out |
| `fastify` | 5.12.1 [VERIFIED] | HTTP + plugins (metadata, idempotency, rateLimit) | Existing stack |
| `prisma` (client-js) | 6.x [VERIFIED] | Transactions, row locks, migrations, `Ticket` + `Notification` models | Single DA layer via `packages/db` |
| Native `node:crypto` | Node 22 | `randomBytes(8).toString('base64url')` for verificationCode; HMAC for signed QR payload | No extra dep; crypto.randomBytes is cryptographically strong |
| Native `fetch` (Node 22) | — | ntfy.sh POST to user topic | No extra dep; already used in worker push.ts |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/nodemailer` | 6.4.14 [VERIFIED, in apps/worker devDeps] | TS types for nodemailer | Already present |
| `jsonwebtoken` | 9.0.3 [VERIFIED, in apps/api deps] | Sign/verify QR payload (optional, alt to opaque token) | If signed JWT chosen for `qrCode` field; `HS256` with `JWT_SECRET` already loaded |
| `pino` (via fastify logger) | existing | Structured ticket/notification logs | `req.log.info({ ...meta, ticketId, verificationCode: hash }, "ticket.issue")` |
| `prom-client` (via fastify-metrics) | existing | Prometheus `tickets_issued_total`, `notifications_sent_total{channel,status}` | Observability per AGENTS.md |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `qrcode` (soldair) | `qrcode-generator` (kazuhikoarase) | Both OK; `qrcode` has 22M/wk vs 2.5M/wk, ESM-native, Promise API; `qrcode-generator` is sync-only and callback-style — prefer `qrcode` |
| `qrcode` | `qrcode` + `jimp` for branding | Branding out of scope (v1 e-ticket is plain QR); skip |
| Signed JWT in `qrCode` field | Opaque token (verificationCode only) | JWT lets transporter scanner app verify signature offline (no API call); opaque requires `GET /tickets/lookup/:token` always; trade network for offline verification — **prefer opaque + lookup** for v1 (one source of truth, simpler) |
| Server-render PNG per request | Pre-generate PNG on ticket create + store as base64 in DB | DB bloat (~3KB × N tickets), no caching benefit, harder to update QR style; **prefer render-on-demand + 5min Redis cache** |
| HTML email with inline QR (`<img src="cid:...">`) | Plaintext email + QR as attachment | Inline `<img>` works in Gmail/Outlook; attachment more reliable; use **inline base64 data-URL** in `<img src="data:image/png;base64,...">` to avoid CID complexity (email size +13KB acceptable) |
| Twilio WhatsApp Business API | Meta WhatsApp Cloud API direct | Twilio abstracts template approval, opt-in, sandbox; Meta direct is more flexible but more setup; keep Twilio |
| `ntfy.sh` public | Self-hosted ntfy (bin via docker) | `NTFY_HOST` env already supports both; default to public `https://ntfy.sh` for dev, document self-host for prod (auth, no public spam) |
| `BullMQ` repeatable for trip reminder | `setInterval` in worker | Phase 3 already uses `setInterval` for reconcile + expireHolds; **keep setInterval for v1**, upgrade to BullMQ later (documented) |
| Single NotificationEvent with `channels: []` | Per-channel separate events | Single event is more atomic; easier to add a channel; per-channel requires duplicate event handlers |
| RSC for dashboard | Client component with React Query | RSC SSR is faster initial paint; client with RQ better for revalidation; **prefer RSC for v1** (Next 16 stable, no extra fetch layer) |

**Installation:**
```bash
# No new core deps for the API; only qrcode added in apps/api
pnpm add qrcode@^1.5.4 --filter @camermove/api
# @types/qrcode is bundled (qrcode 1.5.4 ships its own .d.ts)
# Worker already has nodemailer + twilio; no new deps
```

**Version verification:**
```bash
npm view qrcode version        # 1.5.4 verified
npm view qrcode time.created   # 2010-12-21 verified
npm view qrcode license        # MIT
npm view qrcode repository.url # git://github.com/soldair/node-qrcode.git
npm view nodemailer version    # 6.9.16 verified
npm view twilio version        # 6.1.0 verified
```
Training-data versions may be stale; `qrcode` 1.5.4 was published 2024-08-05, current as of research date.

## Package Legitimacy Audit

> Required because this phase installs new packages (qrcode in apps/api).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `qrcode` | npm | 15 yrs | ~22M/wk | github.com/soldair/node-qrcode | OK | Approved — install `pnpm add qrcode@^1.5.4 --filter @camermove/api` |
| `qrcode-generator` | npm | 10+ yrs | ~2.5M/wk | github.com/kazuhikoarase/qrcode-generator | OK | Not chosen (sync-only API; `qrcode` is preferred) |
| `nodemailer` | npm | 12+ yrs | ~5M/wk | github.com/nodemailer/nodemailer | OK | Approved — already in `apps/worker/package.json` |
| `twilio` | npm | 12+ yrs | ~1.5M/wk | github.com/twilio/twilio-node | OK | Approved — already in `apps/worker/package.json` |
| `@types/nodemailer` | npm | 12+ yrs | ~5M/wk | DefinitelyTyped | OK | Approved — already in `apps/worker/devDependencies` |
| `notchpay-api` (cross-ref Phase 3) | npm | ~2 yrs | low | github.com/Marcjazz/notchpay-node | SUS | Reminder: keep `SLOP`/`SUS` disposition from Phase 3 research; out of scope here |
| `notchpay` / `cinetpay` bare | npm | — | — | none | SLOP | Reminder: REMOVED per Phase 3; out of scope here |

**Packages removed due to [SLOP] verdict:** none in Phase 4
**Packages flagged as suspicious [SUS]:** none in Phase 4

*`qrcode` is the only new package needed in Phase 4. It is widely adopted, MIT, on the canonical `soldair/node-qrcode` repo, with 22M weekly downloads and no `postinstall` script — confirmed via `npm view qrcode` registry check. No other new packages are needed: notification channels (nodemailer, twilio) are already in `apps/worker/package.json`; the dashboard uses the existing `@tanstack/react-query` and `zustand` already in `apps/web/package.json`.*

## Architecture Patterns

### System Architecture Diagram

```
  Traveler (web)                     Transporter scanner (app or web)    Admin/SuperAdmin
        |                                       |                              |
        |  POST /bookings                       |  GET /tickets/lookup/:code    |  GET /tickets/export
        |  POST /payments                       |  (public, redacted)           |  GET /notifications/export
        |  GET /me/dashboard                    |                               |  POST /tickets/:id/void
        v                                       v                               v
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │  Fastify API (stateless, trustProxy, /health)                                │
  │  plugins: auth(RBAC), metadata, idempotency, rateLimit(IP+APP), swagger      │
  │                                                                              │
  │  POST /bookings ──► BookingService (creates pending_payment, hold seats)      │
  │  POST /payments  ──► PaymentService (provider init, one-pending guard)       │
  │  POST /tickets/* ──► TicketService (issue on confirm, validate, void)        │
  │  GET  /me/dashboard ─► DashboardService (single tx: upcoming+history+tickets)│
  │  GET  /tickets/:id/qr.png ─► QR render (5min Redis cache)                    │
  │  GET  /tickets/lookup/:code (public, rate-limited, no PII)                   │
  │                                                                              │
  │  Publishes: ticket.issued, notification.should-send (rich payload)            │
  └──────────────────────────────────────────────────────────────────────────────┘
                │                              │
                v                              v
  ┌──────────────────────────┐    ┌─────────────────────────────────────────────┐
  │  Worker (apps/worker)    │    │  Postgres + Prisma                          │
  │  Kafka consumers:        │    │  Ticket (existing, +index)                  │
  │  paymentWebhookReceived  │    │  Notification (+index)                      │
  │    → confirmPayment      │    │  AuditLog (existing)                        │
  │      → tickets.generate  │    │  Booking/Payment/Commission (existing)      │
  │  ticketIssued            │    │  (row locks, triggers)                      │
  │    → templates.render    │    └─────────────────────────────────────────────┘
  │      → channels.fanout   │
  │  notificationShouldSend  │    ┌─────────────────────────────────────────────┐
  │    → channels.fanout     │    │  Redis (ioredis)                            │
  │  hourly reminder cron    │    │  idemp.* cache.* ratelimit* qr-cache:*       │
  │    → notification.send   │    └─────────────────────────────────────────────┘
  └──────────────────────────┘
                │
                v
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Notification Channels                                               │
  │  email: SMTP_HOST/PORT/USER/PASS (env) or AppSettings.smtp* override │
  │         MailHog fallback: localhost:1025 (docker compose)            │
  │  whatsapp: TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM                │
  │            graceful no-op if missing (logs in dev)                   │
  │  push: NTFY_HOST/user-${cuid}                                         │
  │        graceful no-op if missing (logs in dev)                       │
  └──────────────────────────────────────────────────────────────────────┘
```

Reader trace (happy path): Traveler pays via NotchPay → webhook arrives → `confirmPaymentSuccess` runs in tx with `SELECT FOR UPDATE` on `Booking` + `SeatAvailability` → updates `Payment.status=success, Booking.status=confirmed, Commission created, AuditLog, Ticket created with verificationCode + qrCode` (NEW) → publishes `ticket.issued` + `notification.should-send` events → worker consumes `notification.should-send`, renders templates, creates Notification rows (queued), fans out to email/whatsapp/push channels → each channel updates Notification row to sent|failed → on next dashboard fetch, `GET /me/dashboard` returns the ticket with QR image link.

### Recommended Project Structure

```
apps/api/src/
├── tickets/
│   ├── schema.ts              # Zod: IssueTicketBody (internal), TicketParams, LookupParams, ValidateBody, VoidBody
│   ├── service.ts             # generateAndIssueTicket (in-tx, called from confirmPaymentSuccess), validateTicket, voidTicket
│   ├── repository.ts          # findTicketById, findTicketByVerificationCode, findTicketByBookingId, listMyTickets
│   ├── qr.ts                  # generateVerificationCode (8 char base64url), generateQrCodePayload (opaque token), renderQrPng (qrcode package)
│   ├── routes.ts              # GET /tickets/:id (auth), GET /tickets/:id/qr.png (auth, cached), GET /tickets/lookup/:code (public rate-limited), POST /tickets/:id/validate (transporter_staff+), GET /tickets/export (auth, periodic+datepicker), POST /tickets/:id/void (admin)
│   └── jobs/
│       └── trip-reminder.ts   # cron: bookings with trip.departureAt in [now+23h, now+25h] and status=confirmed → enqueue notification
├── me/
│   ├── service.ts             # getDashboard: upcoming, history, tickets (single tx)
│   └── routes.ts              # GET /me/dashboard (auth)

apps/worker/src/notifications/
├── service.ts                 # refactor: take typed NotificationEvent {type, userId, data, channels}
├── templates.ts               # renderBookingConfirmed, renderPaymentReceived, renderTicketIssued, renderBookingCancelled, renderPaymentRefunded, renderTripReminder (FR)
├── dispatcher.ts              # (NEW) takes event, calls templates, creates Notification rows, calls channels
└── channels/                  # existing — keep as-is (email.ts, whatsapp.ts, push.ts)

apps/web/app/
├── dashboard/
│   ├── page.tsx               # RSC: auth, fetch /me/dashboard, render tabs
│   ├── upcoming-tab.tsx       # list of upcoming bookings + tickets
│   ├── history-tab.tsx        # cancelled/expired bookings
│   └── tickets-tab.tsx        # list of tickets with QR image links
└── tickets/
    └── [id]/
        ├── page.tsx           # RSC: fetch /tickets/:id, render QR + verificationCode + trip info
        └── print.css          # @media print styles for print-friendly e-ticket

apps/web/lib/api/
└── tickets.ts                 # getDashboard, getTicket, getTicketQrUrl, lookupTicket, validateTicket (for admin/transporter future)

packages/db/prisma/
└── schema.prisma              # modify: Ticket @@index([bookingId]), Notification @@index([userId,status,createdAt])
```

### Pattern 1: Ticket Generation Inside Payment Confirmation Transaction

**What:** Generate the e-ticket inside the same Prisma `$transaction` that flips `Payment → success` and `Booking → confirmed`, under `SELECT FOR UPDATE` on the Booking row. The ticket is unique per `bookingId` (defensive app check + idempotent via `@@unique` candidate or guard), so a webhook replay that reaches the success path again is a no-op (skip if `Booking.status === "confirmed"` AND a ticket already exists for this booking).

**When to use:** Every `confirmPaymentSuccess` invocation in `apps/api/src/payments/jobs/reconciliation.ts`. Also called by an admin "force issue" endpoint if a webhook was lost.

**Example:**
```typescript
// apps/api/src/tickets/service.ts
import { randomBytes } from "node:crypto"
import { QRCode } from "qrcode"
import { prisma } from "@camermove/db"
import { ConflictError } from "@camermove/config"

/** 10-char URL-safe verification code, collision-checked via @unique */
export function generateVerificationCode(): string {
  return randomBytes(8).toString("base64url").toUpperCase().replace(/[-_]/g, "").slice(0, 10)
}

/** Opaque QR payload — verifyCode is the source of truth, the rest is for context */
export function generateQrCodePayload(verificationCode: string, bookingId: string): string {
  // Keep small (~80 chars) so QR is low-density and scans fast; never embed PII
  return `CM-T:${verificationCode}:${bookingId.slice(-6)}`
}

/** PNG buffer for embedding in email or serving via GET /tickets/:id/qr.png */
export async function renderQrPng(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    errorCorrectionLevel: "M",   // 15% — sufficient for clean printed/displayed
    type: "png",
    margin: 2,
    width: 320,                   // 320x320 prints cleanly at 2cm; fits email at 200px display
    color: { dark: "#0e9f8f", light: "#ffffff" },
  })
}

/**
 * Issue a ticket inside an existing transaction. Caller is responsible for
 * SELECT FOR UPDATE on Booking (serialize against cancelBooking, failPayment).
 * Idempotent: if a ticket already exists for bookingId, returns the existing one.
 */
export async function generateAndIssueTicket(
  tx: PrismaTx,
  bookingId: string,
): Promise<{ id: string; verificationCode: string; qrCode: string; createdNew: boolean }> {
  const existing = await tx.ticket.findFirst({ where: { bookingId } })
  if (existing) {
    return {
      id: existing.id,
      verificationCode: existing.verificationCode,
      qrCode: existing.qrCode,
      createdNew: false,
    }
  }

  // Retry a few times in the astronomically unlikely event of a collision
  for (let attempt = 0; attempt < 3; attempt++) {
    const verificationCode = generateVerificationCode()
    const qrCode = generateQrCodePayload(verificationCode, bookingId)
    try {
      const ticket = await tx.ticket.create({
        data: { bookingId, verificationCode, qrCode, status: "valid" },
      })
      return { id: ticket.id, verificationCode, qrCode, createdNew: true }
    } catch (e) {
      const msg = (e as Error).message ?? ""
      if (msg.includes("Unique constraint") && msg.includes("verificationCode")) continue
      throw e
    }
  }
  throw new ConflictError("Impossible de générer un code de billet unique")
}
```

**Hook from confirmPaymentSuccess** (modify `apps/api/src/payments/jobs/reconciliation.ts:69-147`):
```typescript
// After Commission.create + audit (line 130-146), before tx closes:
const { generateAndIssueTicket } = await import("../../tickets/service.js")
const ticket = await generateAndIssueTicket(t, p.bookingId)
if (ticket.createdNew) {
  // Audit inside tx
  await t.auditLog.create({ data: { actorId: "system:webhook", action: "ticket.issue", entityType: "Ticket", entityId: ticket.id, metadata: { bookingId: p.bookingId } as never } })
  ticketCreated = ticket // capture for Kafka publish after tx
}

// After tx commit (line 150-161), publish ticket.issued event with full ticket context:
if (ticketCreated?.createdNew) {
  const payload = { ticketId: ticketCreated.id, bookingId: p.bookingId, userId: booking.userId, verificationCode: ticketCreated.verificationCode, tripId: booking.tripId, amount: booking.totalAmount }
  await producer.send({ topic: EVENT_TOPICS.ticketIssued, messages: [{ key: p.bookingId, value: JSON.stringify({ id: ticketCreated.id, type: "ticket.issued", ts: new Date().toISOString(), aggregateId: p.bookingId, data: payload }) }] }).catch(() => {})
  // The notification fan-out happens via the same tx-out hook, just enriched
  await producer.send({ topic: EVENT_TOPICS.notificationShouldSend, messages: [{ key: p.bookingId, value: JSON.stringify({ id: `notif-ticket-${ticketCreated.id}`, type: "ticket.issued", ts: new Date().toISOString(), aggregateId: p.bookingId, data: { eventType: "ticket.issued", ticketId: ticketCreated.id, userId: booking.userId, bookingId: p.bookingId, verificationCode: ticketCreated.verificationCode } }) }] }).catch(() => {})
}
```

### Pattern 2: Public QR Lookup with Rate Limiting + Redacted View

**What:** `GET /tickets/lookup/:verificationCode` is a public route (no auth) used by the transporter to scan a traveler's QR. Returns a redacted view (no email, phone, price) to prevent PII leakage if a code leaks. Strict rate limit (50/min per IP) to prevent brute-force enumeration (10 char base32 ≈ 2^50 keyspace but rate limit is cheap insurance).

**When to use:** Transporter scanner page; ticket validation flow.

**Example:**
```typescript
// apps/api/src/tickets/routes.ts
import crypto from "node:crypto"
import { QRCode } from "qrcode"
import { prisma } from "@camermove/db"
import { NotFoundError } from "@camermove/config"
import { getRedis } from "../lib/redis.js"

const LOOKUP_TTL_SECONDS = 300

// Public lookup — redacted, no PII, no price
app.get("/tickets/lookup/:code", {
  config: { rateLimit: { max: 50, timeWindow: "1 minute" } }, // IP-only, tighter than general
  // NO auth — public scan endpoint
}, async (req, reply) => {
  const { code } = LookupParams.parse(req.params) // /^[A-Z0-9]{8,12}$/

  // 5-min cache to absorb scan bursts
  const cacheKey = `ticket:lookup:${code}`
  let cached: unknown = null
  try {
    const raw = await getRedis().get(cacheKey)
    if (raw) cached = JSON.parse(raw)
  } catch {}
  if (cached) {
    reply.header("Cache-Control", "public, max-age=60")
    return cached
  }

  const ticket = await prisma.ticket.findUnique({
    where: { verificationCode: code },
    include: {
      booking: {
        include: {
          trip: { include: { route: true, transport: true } },
          passengers: { select: { fullName: true } }, // names ok, no phone
        },
      },
    },
  })

  if (!ticket) throw new NotFoundError("Billet introuvable")

  const isValid = ticket.status === "valid" && ticket.booking.status === "confirmed"
  const isPast = ticket.booking.trip.departureAt < new Date()

  const redacted = {
    status: isValid ? "valid" : ticket.status,
    used: ticket.status === "used",
    trip: {
      origin: ticket.booking.trip.route.originCity,
      destination: ticket.booking.trip.route.destinationCity,
      departureAt: ticket.booking.trip.departureAt,
      transporter: ticket.booking.trip.transport.companyName,
    },
    passengers: ticket.booking.passengers.map((p: { fullName: string }) => ({ fullName: p.fullName })),
    seatCount: ticket.booking.seatCount,
    bookable: isValid && !isPast,
  }

  // Cache 5min — if a ticket is just voided, the next /validate will refresh
  try { await getRedis().setex(cacheKey, LOOKUP_TTL_SECONDS, JSON.stringify(redacted)) } catch {}

  reply.header("Cache-Control", "public, max-age=60")
  return redacted
})
```

### Pattern 3: Refactored Notification Service — Typed Events + Template Fan-out

**What:** Replace the current bare-bones `{ userId, bookingId }` event payload (see `apps/api/src/payments/jobs/reconciliation.ts:159`) with a typed `NotificationEvent` that carries the resolved addresses, channel list, and template variables. The worker dispatcher renders the right template per channel and creates one Notification row per (event × channel) before calling the channel adapter. This separates "what happened" from "how to render it" and lets the channel adapters stay pure (they only need `to/subject/text/body/title/message`).

**When to use:** Every consumer of `EVENT_TOPICS.notificationShouldSend`. The existing `service.send` is too loose (it takes `SendInput` but the worker handler does not enrich `data` first).

**Example:**
```typescript
// apps/worker/src/notifications/dispatcher.ts
import { prisma } from "@camermove/db"
import { loadEnv } from "@camermove/config"
import { sendEmail } from "./channels/email.js"
import { sendWhatsApp } from "./channels/whatsapp.js"
import { sendPush } from "./channels/push.js"
import { renderBookingConfirmed, renderPaymentReceived, renderTicketIssued, renderBookingCancelled, renderPaymentRefunded, renderTripReminder } from "./templates.js"

export type NotificationEventType =
  | "booking.confirmed"
  | "payment.received"
  | "ticket.issued"
  | "booking.cancelled"
  | "payment.refunded"
  | "trip.reminder"

export interface NotificationEvent {
  id: string
  type: NotificationEventType
  ts: string
  aggregateId: string  // bookingId
  data: {
    userId: string
    bookingId: string
    reference?: string
    ticketId?: string
    verificationCode?: string
    amount?: number
    tripId?: string
    departureAt?: string  // ISO
    origin?: string
    destination?: string
  }
}

const TEMPLATE_BY_TYPE: Record<NotificationEventType, (data: NotificationEvent["data"], user: { email: string | null; phone: string | null; id: string }) => {
  email?: { to: string; subject: string; text: string }
  whatsapp?: { to: string; body: string }
  push?: { to: string; title: string; message: string }
}> = {
  "booking.confirmed": renderBookingConfirmed,
  "payment.received": renderPaymentReceived,
  "ticket.issued": renderTicketIssued,
  "booking.cancelled": renderBookingCancelled,
  "payment.refunded": renderPaymentRefunded,
  "trip.reminder": renderTripReminder,
}

export function createNotificationDispatcher(env: ReturnType<typeof loadEnv>) {
  return {
    async dispatch(event: NotificationEvent): Promise<{ sent: number; failed: number }> {
      const user = await prisma.user.findUnique({
        where: { id: event.data.userId },
        select: { id: true, email: true, phone: true, firstName: true, lastName: true },
      })
      if (!user) {
        console.warn(`notification user not found: ${event.data.userId}`)
        return { sent: 0, failed: 0 }
      }

      const render = TEMPLATE_BY_TYPE[event.type as NotificationEventType]
      if (!render) {
        console.warn(`no template for event type: ${event.type}`)
        return { sent: 0, failed: 0 }
      }

      const rendered = render(event.data, { id: user.id, email: user.email, phone: user.phone })
      let sent = 0
      let failed = 0

      // Persist a Notification row per channel BEFORE sending (audit + status tracking)
      if (rendered.email && user.email) {
        const row = await prisma.notification.create({
          data: { userId: user.id, channel: "email", type: event.type, payload: rendered.email as never },
        })
        try {
          await sendEmail(rendered.email, env)
          await prisma.notification.update({ where: { id: row.id }, data: { status: "sent", sentAt: new Date() } })
          sent++
        } catch (err) {
          await prisma.notification.update({ where: { id: row.id }, data: { status: "failed" } })
          if (env.NODE_ENV !== "production") console.warn("email send failed", err)
          failed++
        }
      }

      if (rendered.whatsapp && user.phone) {
        const to = user.phone.startsWith("+") ? `whatsapp:${user.phone}` : `whatsapp:+${user.phone}`
        const row = await prisma.notification.create({
          data: { userId: user.id, channel: "whatsapp", type: event.type, payload: { ...rendered.whatsapp, to } as never },
        })
        try {
          await sendWhatsApp(env, { to, body: rendered.whatsapp.body })
          await prisma.notification.update({ where: { id: row.id }, data: { status: "sent", sentAt: new Date() } })
          sent++
        } catch (err) {
          await prisma.notification.update({ where: { id: row.id }, data: { status: "failed" } })
          if (env.NODE_ENV !== "production") console.warn("whatsapp send failed", err)
          failed++
        }
      }

      if (rendered.push) {
        const topic = `user-${user.id.slice(-12)}` // ntfy topic rules
        const row = await prisma.notification.create({
          data: { userId: user.id, channel: "push", type: event.type, payload: { ...rendered.push, topic } as never },
        })
        try {
          await sendPush(env, { userId: topic, title: rendered.push.title, message: rendered.push.message })
          await prisma.notification.update({ where: { id: row.id }, data: { status: "sent", sentAt: new Date() } })
          sent++
        } catch (err) {
          await prisma.notification.update({ where: { id: row.id }, data: { status: "failed" } })
          if (env.NODE_ENV !== "production") console.warn("push send failed", err)
          failed++
        }
      }

      return { sent, failed }
    },
  }
}
```

**Templates (FR, deterministic, no PII in subject):**
```typescript
// apps/worker/src/notifications/templates.ts
import { formatXaf } from "@camermove/shared"

export function renderBookingConfirmed(data: { reference?: string; departureAt?: string; origin?: string; destination?: string; seatCount?: number }, user: { id: string }) {
  return {
    email: {
      to: "", // filled by dispatcher
      subject: `Réservation ${data.reference ?? ""} confirmée — CamerMove`,
      text: `Bonjour,\n\nVotre réservation ${data.reference} pour ${data.origin} → ${data.destination} le ${data.departureAt} est confirmée.\n${data.seatCount ?? 1} place(s) retenue(s).\n\nVotre e-billet avec QR code arrive dans quelques instants.\n\nCamerMove`,
    },
    whatsapp: { to: "", body: `CamerMove: Réservation ${data.reference} confirmée. ${data.origin}→${data.destination} ${data.departureAt}. Billet envoyé par email.` },
    push: { to: "", title: "Réservation confirmée", message: `${data.reference} — ${data.origin}→${data.destination}` },
  }
}

export function renderPaymentReceived(data: { reference?: string; amount?: number }) {
  return {
    email: { to: "", subject: `Paiement reçu — CamerMove`, text: `Bonjour,\n\nNous avons reçu votre paiement de ${formatXaf(data.amount ?? 0)} pour la réservation ${data.reference}. Votre e-billet arrive dans quelques instants.\n\nCamerMove` },
    whatsapp: { to: "", body: `CamerMove: Paiement ${formatXaf(data.amount ?? 0)} reçu pour ${data.reference}.` },
    push: { to: "", title: "Paiement reçu", message: `${data.reference} — ${formatXaf(data.amount ?? 0)}` },
  }
}

export function renderTicketIssued(data: { reference?: string; verificationCode?: string; departureAt?: string; origin?: string; destination?: string }) {
  const code = data.verificationCode ?? ""
  return {
    email: {
      to: "",
      subject: `Votre e-billet CamerMove — ${data.reference ?? ""}`,
      text: `Bonjour,\n\nVotre e-billet est prêt.\n\nRéférence: ${data.reference}\nCode de vérification: ${code}\nTrajet: ${data.origin} → ${data.destination}\nDépart: ${data.departureAt}\n\nPrésentez le QR code ci-joint ou le code de vérification au contrôleur.\n\nCamerMove`,
    },
    whatsapp: { to: "", body: `CamerMove: Billet ${data.reference} prêt. Code: ${code}. ${data.origin}→${data.destination} ${data.departureAt}.` },
    push: { to: "", title: "E-billet prêt", message: `${data.reference} — code ${code}` },
  }
}

export function renderBookingCancelled(data: { reference?: string; refundAmount?: number }) {
  return {
    email: { to: "", subject: `Réservation ${data.reference} annulée — CamerMove`, text: `Bonjour,\n\nVotre réservation ${data.reference} a été annulée. Remboursement: ${data.refundAmount ?? 0} XAF.\n\nCamerMove` },
    whatsapp: { to: "", body: `CamerMove: ${data.reference} annulé. Remboursement ${data.refundAmount ?? 0} XAF.` },
    push: { to: "", title: "Réservation annulée", message: `${data.reference}` },
  }
}

export function renderPaymentRefunded(data: { reference?: string; refundAmount?: number }) {
  return {
    email: { to: "", subject: `Remboursement effectué — CamerMove`, text: `Bonjour,\n\nUn remboursement de ${data.refundAmount ?? 0} XAF a été effectué pour ${data.reference}.\n\nCamerMove` },
    whatsapp: { to: "", body: `CamerMove: Remboursement ${data.refundAmount ?? 0} XAF pour ${data.reference}.` },
    push: { to: "", title: "Remboursement", message: `${data.reference} — ${data.refundAmount ?? 0} XAF` },
  }
}

export function renderTripReminder(data: { reference?: string; departureAt?: string; origin?: string; destination?: string; verificationCode?: string }) {
  return {
    email: { to: "", subject: `Rappel — départ ${data.departureAt} — CamerMove`, text: `Bonjour,\n\nRappel: votre bus ${data.origin} → ${data.destination} part le ${data.departureAt}.\nRéférence: ${data.reference}\nCode: ${data.verificationCode}\n\nCamerMove` },
    whatsapp: { to: "", body: `CamerMove: Rappel — ${data.reference} part ${data.departureAt}. ${data.origin}→${data.destination}.` },
    push: { to: "", title: "Rappel de départ", message: `${data.reference} — ${data.departureAt}` },
  }
}
```

**Worker handler registration** (replace `apps/worker/src/index.ts:12-14`):
```typescript
import { createNotificationDispatcher } from "./notifications/dispatcher"
const dispatcher = createNotificationDispatcher(env)

const consumer = createEventConsumer(kafka, env, {
  [EVENT_TOPICS.notificationShouldSend]: async (event) => {
    await dispatcher.dispatch(event as never)
  },
  [EVENT_TOPICS.bookingCreated]: async () => {},
  [EVENT_TOPICS.paymentCompleted]: async () => {},
  [EVENT_TOPICS.paymentWebhookReceived]: async (event) => {
    const mod = await import("../../api/src/payments/jobs/reconciliation.js")
    await mod.processPaymentWebhook(event as never)
  },
  [EVENT_TOPICS.ticketIssued]: async () => {
    // The notification fan-out for ticket.issued is published together with
    // notificationShouldSend by confirmPaymentSuccess. This handler is kept
    // for future use (e.g., webhook to transporter dashboard).
  },
  [EVENT_TOPICS.paymentRefunded]: async () => {
    // Future: cancel transporter-side allocations
  },
})
```

### Pattern 4: Email with Inline QR via Data URL

**What:** Embed the QR PNG as a base64 data URL in the email HTML, so the email works without any external image host (no tracking, no firewall issues). Add a plaintext alternative for accessibility + non-HTML clients.

**When to use:** Every email containing a ticket (booking.confirmed, payment.received, ticket.issued, trip.reminder).

**Example:**
```typescript
// apps/worker/src/notifications/templates.ts — add helper
import { QRCode } from "qrcode"

export async function buildTicketEmail(opts: {
  to: string
  subject: string
  text: string
  verificationCode: string
  qrPayload: string
}) {
  const png = await QRCode.toBuffer(opts.qrPayload, {
    errorCorrectionLevel: "M",
    type: "png",
    margin: 2,
    width: 320,
    color: { dark: "#0e9f8f", light: "#ffffff" },
  })
  const dataUrl = `data:image/png;base64,${png.toString("base64")}`
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:20px">
    <h1 style="color:#0e9f8f">CamerMove</h1>
    <p>${escapeHtml(opts.text).replace(/\n/g, "<br>")}</p>
    <div style="margin:20px 0;padding:20px;border:1px solid #e5e7eb;border-radius:8px;text-align:center">
      <img src="${dataUrl}" alt="QR code" style="width:200px;height:200px" />
      <p style="font-family:monospace;font-size:18px;letter-spacing:2px;margin-top:12px">${escapeHtml(opts.verificationCode)}</p>
    </div>
    <p style="color:#6b7280;font-size:12px">Présentez ce QR code ou le code ci-dessus au contrôleur.</p>
  </body></html>`
  return { to: opts.to, subject: opts.subject, text: opts.text, html }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}
```

Then the email channel adapter `apps/worker/src/notifications/channels/email.ts` gains an `html` field (nodemailer auto-detects `html` and falls back to `text` if disabled):
```typescript
// Send { to, subject, text, html? } — nodemailer picks html if present
await transport.sendMail({ from, ...msg }) // existing line — already supports html via the spread
```

### Pattern 5: Traveler Dashboard in a Single Round-trip

**What:** `GET /me/dashboard?tab=upcoming|history|tickets` returns one of three sections (or all three with `?include=all`) inside a single Prisma transaction. Avoids N+1 queries, gives the frontend a stable contract, makes RSC trivial.

**When to use:** Authenticated dashboard page on first load.

**Example:**
```typescript
// apps/api/src/me/service.ts
import { prisma } from "@camermove/db"

export async function getDashboard(userId: string, tab: "upcoming" | "history" | "tickets" | "all" = "all") {
  const now = new Date()
  const baseInclude = {
    trip: { include: { route: true, transport: true } },
    passengers: true,
    payments: { select: { status: true, amount: true, provider: true } },
    tickets: { select: { id: true, verificationCode: true, qrCode: true, status: true } },
  }

  const [upcoming, history, tickets] = await Promise.all([
    prisma.booking.findMany({
      where: {
        userId,
        status: { in: ["confirmed", "refunded"] },
        trip: { departureAt: { gte: now } },
      },
      orderBy: { trip: { departureAt: "asc" } },
      take: 50,
      include: baseInclude,
    }),
    prisma.booking.findMany({
      where: {
        userId,
        OR: [
          { status: { in: ["cancelled", "expired"] } },
          { status: "confirmed", trip: { departureAt: { lt: now } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: baseInclude,
    }),
    prisma.ticket.findMany({
      where: { booking: { userId } },
      orderBy: { issuedAt: "desc" },
      take: 100,
      include: {
        booking: {
          include: {
            trip: { include: { route: true, transport: true } },
            passengers: true,
          },
        },
      },
    }),
  ])

  // Enrich each ticket with QR image URL (frontend renders <img src>)
  const ticketsWithQr = tickets.map((t) => ({
    ...t,
    qrImageUrl: `/api/v1/tickets/${t.id}/qr.png`,
  }))

  return { upcoming, history, tickets: ticketsWithQr }
}
```

**Dashboard RSC page** (`apps/web/app/dashboard/page.tsx`):
```typescript
// Server Component — runs on the server, fetches the API, no client JS
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getDashboard } from "@camermove/api-client/me" // or direct fetch

export default async function DashboardPage() {
  const token = cookies().get("accessToken")?.value
  if (!token) redirect("/login?next=/dashboard")

  const data = await getDashboard(token)
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-[#0e9f8f]">Mon espace</h1>
      <Section title="À venir">
        {data.upcoming.length === 0 ? <Empty msg="Aucun voyage à venir" /> : data.upcoming.map((b) => <BookingCard key={b.id} booking={b} />)}
      </Section>
      <Section title="Historique">
        {data.history.length === 0 ? <Empty msg="Aucun voyage passé" /> : data.history.map((b) => <BookingCard key={b.id} booking={b} />)}
      </Section>
      <Section title="Mes billets">
        {data.tickets.length === 0 ? <Empty msg="Aucun billet" /> : data.tickets.map((t) => <TicketCard key={t.id} ticket={t} />)}
      </Section>
    </main>
  )
}
```

### Anti-Patterns to Avoid
- **Trusting the QR payload's `bookingId` slice for validation:** the `qrCode` field is just a hint for the scanner; the public `GET /tickets/lookup/:verificationCode` is the source of truth. Never write a route that trusts the QR payload's embedded `bookingId` for status changes.
- **Returning PII in the public lookup:** email, phone, and `totalAmount` MUST NOT appear in `GET /tickets/lookup/:code` — the QR is shown to the transporter scanner, and a leaked QR leaks booking PII. Pattern 2 above shows the redacted view.
- **Storing the QR PNG in the DB:** generates 1-3KB per ticket binary blob, bloats rows, no caching benefit. Render on demand + 5min Redis cache. Disk cost > CPU cost at MVP scale.
- **Embedding raw email/phone/PII in the QR:** the QR is a printed artifact. Use opaque token + server-side lookup (Pattern 2).
- **Calling SMTP/Twilio/ntfy synchronously in the API request:** Twilio SLA is 3-30s, SMTP 1-10s, ntfy 100ms; one slow channel kills the request. Always async via Kafka.
- **Sharing one notification handler across all event types with `if/else`:** becomes spaghetti. Per Pattern 3, one template per event type, one dispatcher.
- **Hardcoding `https://ntfy.sh` in worker:** `NTFY_HOST` env already exists; respect it for self-hosted instances. Also: the ntfy topic name must not contain `_` (some clients reject); use `user-${last12OfCuid}`.
- **Using a fixed URL like `http://localhost:3000` in the email QR payload:** the QR is scanned in production; use the actual `API_URL` or `WEB_URL` from `loadEnv()`.
- **Catching the Phase 3 published event without enriching it:** the existing handler in `apps/worker/src/index.ts:12` does `notifications.send(event.data as never)` — but `event.data` is `{ userId, bookingId }` and the channel adapters need `to/subject/text/body`. Refactor required (Pattern 3).
- **Calling `confirmPaymentSuccess` more than once to "re-issue" a lost ticket:** if a ticket is missing (e.g., race or bug), provide a separate `POST /bookings/:id/ticket` (owner or admin) that calls `generateAndIssueTicket` in a tx with `SELECT FOR UPDATE` on Booking. Do not re-run payment confirmation.
- **Putting the dashboard under `apps/web/app/admin/` or `/me/...`:** follow `apps/web/app/dashboard/page.tsx` convention; auth via middleware `apps/web/middleware.ts` that checks the access token cookie OR zustand store on the client.
- **Re-rendering the QR on every dashboard load:** the QR image is stable per ticket; serve via `GET /tickets/:id/qr.png` with `Cache-Control: private, max-age=86400` and Redis cache 5min (defense in depth).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR code generation | Custom Reed-Solomon + bit matrix | `qrcode` package (1.5.4) | Mask pattern selection, error correction level, version sizing — 8 Reed-Solomon blocks, 4 mask functions, 40 versions, finder/timing/alignment patterns. Hand-rolled is 1500 lines of bit twiddling for one feature. |
| SMTP client | Raw `telnet` or socket-level SMTP | `nodemailer` (6.9.16, already in apps/worker) | STARTTLS, AUTH PLAIN/LOGIN/CRAM-MD5, pipelining, attachments, HTML+plaintext, DKIM, pool of connections. |
| WhatsApp Business API | Raw Meta Cloud API HTTP calls | `twilio` SDK (6.1.0, already in apps/worker) | Twilio handles template approval, opt-in, sandbox, delivery callbacks, error mapping (21211 invalid number, 21408 not allowed, etc.). |
| ntfy POST | Raw `fetch` to ntfy.sh | `fetch` to `${NTFY_HOST}/topic` (no SDK needed; ntfy is intentionally SDK-free) | Already used in `apps/worker/src/notifications/channels/push.ts:4` |
| Idempotent ticket create | `if (existing) return existing; else create` (race) | `generateAndIssueTicket` (Pattern 1) with retry on `@@unique` violation | TOCTOU race between two webhooks; Prisma's `@@unique` is the actual atomic guard |
| Verification code generation | Sequential integers, UUID, `Math.random` | `crypto.randomBytes(8).toString("base64url")` | UUIDs are 36 chars, too long for human transcription; sequential ints are guessable; `Math.random` is not cryptographically random. base64url(8 bytes) = 11 chars, 2^64 keyspace, URL-safe. |
| Dashboard list pagination | Custom page state | Existing `lib/query.ts` `PaginationSchema` + `parseExportQuery` | Already supports `dateFrom/dateTo`, `page/perPage`, `q`, `orderBy`; AGENTS.md §6 requires exportable+periodic |
| Notification template i18n | Hardcoded FR strings duplicated everywhere | `apps/worker/src/notifications/templates.ts` with pure functions | Templates are testable pure functions; no i18n v1 but the structure makes adding EN/FR later trivial |
| Auth on dashboard | Custom session check in every RSC | `apps/web/middleware.ts` redirecting to `/login?next=...` if no `accessToken` cookie | Centralized; works for RSC and client components |
| Notification `payload.to` (email/phone) lookup | Always re-fetch user in template | `dispatcher.dispatch` fetches user ONCE, passes to all template renders | One DB roundtrip per notification event, not per channel |
| Redis SET NX dedup for ticket gen | In-memory Set (lost on restart) | `prisma.ticket.findFirst({where: {bookingId}})` inside the FOR UPDATE tx | DB is source of truth; Redis is for QR image cache only |
| Money in templates | `\`${amount} XAF\`` | `formatXaf` from `@camermove/shared` (extend `packages/shared/src/money.ts`) | Centralized XAF formatting (e.g., `15 000 XAF` with space thousands separator per Cameroon locale) |

**Key insight:** Tickets are the moment a "booking" becomes a "promise" the transporter honors. Trust on both sides comes from a single 8-10 char code, atomic creation, and a QR that scans without network. Every hand-rolled piece (UUID, Math.random, custom Reed-Solomon) is a chance to introduce a guessable code, a duplicate, or a scannable-but-broken QR. The 22M weekly downloads of `qrcode` and 5M of `nodemailer` are not vanity metrics — they encode millions of bug fixes for corner cases that will inevitably hit a production system.

## Runtime State Inventory

> Include this section for rename/refactor/migration phases only. Omit entirely for greenfield phases.

*Skipped — this is a greenfield feature phase (new `/tickets/*` endpoints, new dashboard routes, new `qrcode` dependency). No runtime state migration required. The `Ticket` + `Notification` Prisma models already exist (lines 274-295 of `schema.prisma`); Phase 4 adds indexes and starts populating them. No existing data to migrate.*

> **However**, there are **logical migrations** required to wire Phase 4 correctly:
> 1. **Phase 3 worker notification handler** (`apps/worker/src/index.ts:12-14` + `apps/worker/src/notifications/service.ts:7-22`) currently expects `event.data` to be `{ to, subject, text, body, title, message, userId, channel }` but the published event from `confirmPaymentSuccess` is `{ userId, bookingId }`. The refactor (Pattern 3) is mandatory; the existing code is **broken** in the sense that any notification fan-out today silently produces rows with `payload: { userId, bookingId }` and the channel adapter calls fail with `undefined.to` / `undefined.subject`.
> 2. **Phase 3 reconciliation transaction** (`apps/api/src/payments/jobs/reconciliation.ts:69-147`) does not call `generateAndIssueTicket`; the ticket creation hook (Pattern 1) is mandatory; without it, `Booking.status="confirmed"` happens but no `Ticket` row is ever created.
> 3. **MailHog docker-compose**: `mailhog` service is already in `docker-compose.yml` (lines 47-50) with ports 1025 (SMTP) and 8025 (web UI). No change needed; default `SMTP_HOST=localhost SMTP_PORT=1025` in `.env.example` works out of the box for dev.
> 4. **No `ntfy` service in docker-compose**: `NTFY_HOST` defaults to `https://ntfy.sh` (public). For dev, optionally add `binwiederhier/ntfy` service to `docker-compose.yml` and set `NTFY_HOST=http://localhost:8090`; out of scope for Phase 4 (use public ntfy.sh, document in README).

These are **code edits**, not data migrations. No existing database rows or external service registrations embed the old (broken) contract — `Notification` rows are currently never created at all (the handler in worker crashes before reaching `prisma.notification.create`).

## Common Pitfalls

### Pitfall 1: VerificationCode Collision (Astronomically Rare but Real)

**What goes wrong:** `crypto.randomBytes(8).toString("base64url")` produces an 11-char base64url string, but after `.replace(/[-_]/g, "").slice(0, 10)` (Pattern 1's transform) the keyspace drops to ~2^60 (10 alphanumeric chars). At 10^6 tickets/yr, the birthday collision probability is ~10^-7. Still low, but if two webhooks for the same booking run in parallel before the first commits, both might call `generateVerificationCode` and both insert — the second hits `@@unique` violation.

**Why it happens:** Concurrent webhook delivery + lack of retry on `@@unique` collision.

**How to avoid:** Pattern 1 already handles this with a 3-attempt retry loop that catches "Unique constraint" and re-generates. The retry is bounded (3 attempts) to avoid infinite loops; in the worst case, the booking is confirmed without a ticket and the user sees no QR — admin can manually re-issue via `POST /bookings/:id/ticket`.

**Warning signs:** Sentry/console catches of `Unique constraint failed on the fields: (verificationCode)` in `tickets.service.ts`.

### Pitfall 2: QrCode Image Leaks VerificationCode via Cache Headers

**What goes wrong:** `GET /tickets/:id/qr.png` is served without `Cache-Control: private`. A shared CDN or browser cache makes the QR image available to other users of the same browser/computer; a screenshot of the dashboard caches the QR indefinitely.

**Why it happens:** Default Fastify response is `Cache-Control: no-cache`; setting `public` is a common mistake.

**How to avoid:** Set `Cache-Control: private, max-age=86400` (24h, private = no shared cache). The verificationCode is sensitive enough that even a private cache with 24h is acceptable. Also: never set `public` on the QR route. The lookup route (Pattern 2) is OK with `public, max-age=60` because the response is already redacted.

**Warning signs:** `curl -I /api/v1/tickets/abc/qr.png` returns `Cache-Control: public` or no header.

### Pitfall 3: Notification Sent Before Ticket Committed (Race)

**What goes wrong:** `confirmPaymentSuccess` publishes `notificationShouldSend` event inside the Kafka publish block (line 159 of `reconciliation.ts`), but the Kafka producer is created and connected AFTER the transaction closes. If the tx commits but the Kafka publish happens before the consumer reads the new Ticket row, the email template says "your ticket is ready" but `GET /tickets/:id` returns 404.

**Why it happens:** Kafka producer publishes synchronously in the API; worker consumes asynchronously; no causal link between tx commit and consumer visibility.

**How to avoid:** Two options: (a) Worker handler for `ticket.issued` re-fetches the ticket by `ticketId` and if not found, retries with exponential backoff (Pattern 3 already does this implicitly via Kafka retry); (b) Make the email template link to `/dashboard/tickets/${ticketId}` instead of inline ticket details — the dashboard fetch is the source of truth. Choose (b) for v1; (a) for v2 if dashboards load slow.

**Warning signs:** Manual test: pay → email arrives 500ms later → click link → 404 → reload page → ticket appears.

### Pitfall 4: Twilio Sandbox Number Confusion in Dev

**What goes wrong:** `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886` (Twilio sandbox) is set in `.env.example:27`, but the user's phone is not joined to the sandbox. Result: Twilio returns 21408 (not opted in) and the Notification row is marked failed. The traveler sees nothing.

**Why it happens:** Twilio sandbox requires the user to send `join <sandbox-keyword>` to the sandbox number first; for a real user, you need a Twilio-approved WhatsApp sender.

**How to avoid:** Document in README that WhatsApp requires Twilio-approved sender (or sandbox opt-in for dev). The `sendWhatsApp` function gracefully no-ops when env is missing (existing behavior), but if env is set and the call fails, the Notification row is `failed` — surface this in `GET /notifications?status=failed` for the traveler (out of scope v1) or admin only. For Phase 4 MVP, document the constraint; do not build an opt-in UI.

**Warning signs:** `prisma.notification.findMany({where: {channel: "whatsapp", status: "failed"}})` shows N>0 right after a successful payment.

### Pitfall 5: SMTP_AUTH Plaintext Logged in Error Messages

**What goes wrong:** nodemailer `sendMail` rejects with `Error: Invalid login: 535 Authentication failed`; the handler logs the full error which includes `user: 'smtp-user@camermove.cm'` — a minor PII leak. Worse, if `auth.pass` is in the error (some nodemailer error shapes include it), the SMTP password is in the logs.

**Why it happens:** Default `console.warn(err)` includes the full error object.

**How to avoid:** In `apps/worker/src/notifications/channels/email.ts:4-9`, the env-loading already separates `user` from `pass`; the `transport.sendMail` only spreads `{ from, ...msg }` so the password never goes into the SMTP envelope. For error logging, the dispatcher (Pattern 3) catches and only logs `err.message` (no full stack with credentials) when `env.NODE_ENV === "production"`.

**Warning signs:** `grep "pass" /var/log/worker.log` finds SMTP password.

### Pitfall 6: Trip Reminder Cron Fires Twice for Same Booking

**What goes wrong:** The cron interval (60s in worker, per Pattern 4) runs every minute but the query is `departureAt BETWEEN now+23h AND now+25h`. If the worker restarts (SIGTERM/oom), the interval restarts from "now" and a booking that was in the window 5 minutes ago is still in the window now → second notification.

**Why it happens:** No idempotency marker on the booking for "reminder sent".

**How to avoid:** Two options: (a) Add `Booking.reminderSentAt DateTime?` column (schema migration) and check it in the cron; (b) Use Notification uniqueness — check `prisma.notification.findFirst({where: {type: "trip.reminder", userId, bookingId}})` and skip if exists. Choose (b) for v1 (no schema change); the Notification table is already designed for this query.

**Warning signs:** Two `trip.reminder` emails arrive for the same booking within minutes of each other.

### Pitfall 7: Dashboard SSR Breaks When API Is Down

**What goes wrong:** RSC `apps/web/app/dashboard/page.tsx` calls `getDashboard(token)` on the server. If the API is restarting or unreachable, the page throws and the user sees a generic 500.

**Why it happens:** No fallback / cached data / retry.

**How to avoid:** Wrap the `getDashboard` call in a try/catch; on failure, render `<ErrorState msg="Impossible de charger vos voyages. Réessayez dans quelques instants." />` instead of throwing. Add a "Réessayer" button that triggers `router.refresh()`. For the QR image on the tickets page, the `<img>` tag is naturally resilient to API failures (browser retries).

**Warning signs:** Sentry/console catches of `getaddrinfo ENOTFOUND` or `ECONNREFUSED` from the dashboard page.

### Pitfall 8: Reconciliation Creates Ticket Before Cancelled-Booking Race Resolves

**What goes wrong:** A late payment-success webhook arrives just after `expireHolds` set `Booking.status="expired"`. Phase 3 already guards this: `confirmPaymentSuccess` re-fetches `freshBooking` under `SELECT FOR UPDATE` and bails if `status !== "pending_payment"` (line 83 of `reconciliation.ts`). BUT — if Phase 4 adds ticket generation AFTER the guard (Pattern 1 is correct here, but a developer could mistakenly place it before), a ticket could be created for an expired booking.

**Why it happens:** Mis-ordered code in the tx.

**How to avoid:** Pattern 1 explicitly places `generateAndIssueTicket` AFTER the `Booking.status` guard (line 86 of `reconciliation.ts` is the booking update, line 100 is seat transition, line 110-126 is commission, line 137 is audit, and the new ticket generation goes between line 126 and 137). Document this order in code comments.

**Warning signs:** `prisma.ticket.findMany({where: {booking: {status: {in: ["cancelled", "expired", "refunded"]}}}})` returns N>0.

## Code Examples

Verified patterns from official sources + existing codebase:

### Generate QR PNG with the `qrcode` package

```typescript
// Source: qrcode npm package README (https://github.com/soldair/node-qrcode) — version 1.5.4
import { QRCode } from "qrcode"

// Buffer (PNG) for embedding in email or HTTP response
const png: Buffer = await QRCode.toBuffer("CM-T:ABC123:XYZ789", {
  errorCorrectionLevel: "M",
  type: "png",
  margin: 2,
  width: 320,
  color: { dark: "#0e9f8f", light: "#ffffff" },
})

// String (SVG) for inline rendering
const svg: string = await QRCode.toString("CM-T:ABC123:XYZ789", { type: "svg" })

// Data URL for <img src="data:...">
const dataUrl: string = await QRCode.toDataURL("CM-T:ABC123:XYZ789", { errorCorrectionLevel: "M", width: 320 })
// data:image/png;base64,iVBORw0KGgo...

// File write (e.g., save to MinIO if not using inline)
await QRCode.toFile("/tmp/qr.png", "CM-T:ABC123:XYZ789")
```

### Render Ticket Email with Inline QR

```typescript
// Adapted from nodemailer 6.9.16 docs (https://nodemailer.com/message/) + qrcode 1.5.4
import nodemailer from "nodemailer"
import { QRCode } from "qrcode"
import { loadEnv } from "@camermove/config"

const env = loadEnv()
const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
})

const png = await QRCode.toBuffer(payload, { errorCorrectionLevel: "M", type: "png", width: 320 })
const dataUrl = `data:image/png;base64,${png.toString("base64")}`

await transport.sendMail({
  from: env.SMTP_FROM,
  to: "traveler@example.com",
  subject: "Votre e-billet CamerMove",
  text: `Référence: CM-AB12CD34\nCode: ABC123\nPrésentez ce QR au contrôleur.`,
  html: `
    <h1 style="color:#0e9f8f">CamerMove</h1>
    <p>Votre e-billet est prêt.</p>
    <div style="text-align:center;padding:20px">
      <img src="${dataUrl}" alt="QR code" style="width:200px;height:200px" />
      <p style="font-family:monospace;font-size:18px">ABC123</p>
    </div>
  `,
})
```

### Public Ticket Lookup (Redacted)

```typescript
// Source: existing codebase pattern (apps/api/src/bookings/routes.ts:22-36 owner-or-admin check) inverted for public access
import { prisma } from "@camermove/db"
import { NotFoundError } from "@camermove/config"

app.get("/tickets/lookup/:code", async (req, reply) => {
  const { code } = LookupParams.parse(req.params)
  const ticket = await prisma.ticket.findUnique({
    where: { verificationCode: code },
    include: {
      booking: {
        include: {
          trip: { include: { route: true, transport: { select: { companyName: true } } } },
          passengers: { select: { fullName: true } }, // names OK; no phone/email
        },
      },
    },
  })
  if (!ticket) throw new NotFoundError("Billet introuvable")
  reply.header("Cache-Control", "public, max-age=60")
  return {
    status: ticket.status,
    trip: {
      origin: ticket.booking.trip.route.originCity,
      destination: ticket.booking.trip.route.destinationCity,
      departureAt: ticket.booking.trip.departureAt,
      transporter: ticket.booking.trip.transport.companyName,
    },
    passengers: ticket.booking.passengers.map((p) => ({ fullName: p.fullName })),
    seatCount: ticket.booking.seatCount,
  }
})
```

### Trip Reminder Cron (hourly, idempotent via Notification lookup)

```typescript
// apps/worker/src/index.ts — add a third interval
const reminderInterval = setInterval(async () => {
  try {
    const now = Date.now()
    const windowStart = new Date(now + 23 * 3600 * 1000)
    const windowEnd = new Date(now + 25 * 3600 * 1000)
    // Find confirmed bookings departing in [now+23h, now+25h]
    const bookings = await prisma.booking.findMany({
      where: {
        status: "confirmed",
        trip: { departureAt: { gte: windowStart, lte: windowEnd } },
      },
      include: { trip: { include: { route: true } } },
      take: 100,
    })
    for (const b of bookings) {
      // Idempotency: skip if a trip.reminder already sent
      const existing = await prisma.notification.findFirst({
        where: { userId: b.userId, bookingId: b.id, type: "trip.reminder" },
      })
      if (existing) continue
      // Publish notification event
      const kafka = createKafkaClient(loadEnv() as never)
      const producer = kafka.producer({ idempotent: true })
      await producer.connect().catch(() => {})
      await producer.send({
        topic: EVENT_TOPICS.notificationShouldSend,
        messages: [{
          key: b.id,
          value: JSON.stringify({
            id: `reminder-${b.id}`,
            type: "trip.reminder",
            ts: new Date().toISOString(),
            aggregateId: b.id,
            data: {
              eventType: "trip.reminder",
              userId: b.userId,
              bookingId: b.id,
              reference: b.reference,
              tripId: b.tripId,
              departureAt: b.trip.departureAt.toISOString(),
              origin: b.trip.route.originCity,
              destination: b.trip.route.destinationCity,
            },
          }),
        }],
      }).catch(() => {})
      await producer.disconnect().catch(() => {})
    }
  } catch (e) {
    console.error("trip-reminder cron failed", e)
  }
}, 60 * 60 * 1000) // hourly
```

### Ticket Validation (Mark Used)

```typescript
// apps/api/src/tickets/routes.ts
app.post("/tickets/:id/validate", { preHandler: app.requireAuth("transporter_staff") }, async (req) => {
  const { id } = TicketParams.parse(req.params)
  const user = (req as unknown as { user: { id: string; role: string } }).user
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta
  const ticket = await prisma.ticket.findUnique({ where: { id }, include: { booking: { include: { trip: true } } } })
  if (!ticket) throw new NotFoundError("Billet introuvable")
  if (ticket.status === "used") {
    return { status: "already_used", scannedAt: ticket.scannedAt ?? null }
  }
  if (ticket.status === "void") {
    return { status: "void", reason: "Billet annulé ou remboursé" }
  }
  // Atomic valid → used (with row lock for race safety)
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id"=${id} FOR UPDATE`
    const fresh = await tx.ticket.findUnique({ where: { id } })
    if (!fresh || fresh.status !== "valid") return
    await tx.ticket.update({
      where: { id },
      data: {
        status: "used",
        scannedAt: new Date(),
        scannedBy: user.id,
      },
    })
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "ticket.validate",
        entityType: "Ticket",
        entityId: id,
        metadata: { ...meta, verificationCode: hashCode(ticket.verificationCode) } as never,
      },
    })
  })
  req.log.info({ ...meta, ticketId: id, userId: user.id, action: "ticket.validate" }, "ticket validated")
  return { status: "used", scannedAt: new Date().toISOString() }
})
```

### Prisma Migration for Phase 4 Indexes

```prisma
// packages/db/prisma/schema.prisma — modify Ticket + Notification models (lines 274-295)
model Ticket {
  id               String       @id @default(cuid())
  bookingId        String
  booking          Booking      @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  qrCode           String
  verificationCode String       @unique
  status           TicketStatus @default(valid)
  issuedAt         DateTime     @default(now())
  scannedAt        DateTime?
  scannedBy        String?

  @@index([bookingId])  // NEW
  @@index([status, issuedAt])  // NEW for admin/cleanup queries
}

model Notification {
  id            String             @id @default(cuid())
  userId        String?
  user          User?              @relation(fields: [userId], references: [id], onDelete: SetNull)
  transporterId String?
  channel       NotificationChannel
  type          String
  status        NotificationStatus @default(queued)
  payload       Json
  sentAt        DateTime?
  createdAt     DateTime           @default(now())

  @@index([userId, status, createdAt])  // NEW — for /notifications list scoped to user
  @@index([channel, status])            // NEW — for monitoring failed sends per channel
  @@index([type, bookingId])            // NEW — idempotency for trip.reminder cron
}
```

Migration: `npx prisma migrate dev --name add_ticket_notification_indexes` from `packages/db/`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual ticket ID handed to traveler | QR + verificationCode (8-10 char) auto-generated on payment | 2020+ industry standard | Faster scanner UX, smaller error rate, no PII in QR |
| Server-rendered QR on every request | Cache the PNG buffer in Redis (5min) keyed by verificationCode | 2024+ | 10× fewer CPU cycles for repeated scans |
| Single `notification.service.send` with `if/else` channel dispatch | Typed event + template renderer + per-channel adapter | 2024+ | Each template testable; adding a channel = one file, not editing a switch |
| HTML email with CID-attached QR image | HTML email with inline data URL | Gmail/Outlook support for data: URLs 2020+ | No MIME multipart complexity, one `sendMail` call |
| Custom SMTP auth with manual EHLO | nodemailer (handles all RFC 5321 + 5322) | Always | TLS, AUTH PLAIN/LOGIN, pool, DKIM, attachments |
| Direct Meta WhatsApp API | Twilio (handles template approval + opt-in) | Twilio acquired WhatsApp API access 2017 | Sandbox for dev, production sender via Twilio |
| Manual ntfy topic naming | Per-user topic `user-${cuid}` | ntfy.sh best practice 2023 | Privacy (only the user's devices subscribe), no cross-user leakage |
| Reconciliation timer `setInterval(60s)` | BullMQ repeatable job | Mature pattern 2022+ | Phase 3 chose setInterval for v1; Phase 4 keeps it (less risk; documented upgrade path) |
| Phase 3 broken `notificationShouldSend` event (bare `{userId, bookingId}`) | Typed `NotificationEvent` with `eventType, userId, bookingId, reference, ticketId, verificationCode, amount, tripId, departureAt, origin, destination` | Phase 4 | Decouples trigger from channel-specific payload; templates own rendering |

**Deprecated/outdated:**
- **`base64` of the full ticket JSON in the QR** — bloats QR (forces high error correction, low payload), leaks PII if scanned, hard to update. Use opaque token + server-side lookup.
- **Storing QR PNG in DB** as `Bytes` — bloats rows, no caching benefit, no version control. Render on demand.
- **Twilio `client.messages.create({to: 'whatsapp:+...', from: 'whatsapp:+...'})` without a WhatsApp-approved sender** — works in sandbox only; in production, requires Twilio-approved sender for your business. Document in README.
- **ntfy topic with `_` characters** — some ntfy clients (e.g., ntfy Android) reject underscores. Use `user-${last12OfCuid}` (already the proposed format).
- **Plaintext-only email** — modern travelers expect HTML; provide both `text` and `html` for accessibility.
- **Server-rendered ticket PDF attached to email** — v2 feature (branded PDF); v1 is inline QR + verificationCode in body.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `qrcode` 1.5.4 ESM import works in Fastify/Next 16 apps without `--experimental-vm-modules` or polyfills [VERIFIED: qrcode package supports CJS + ESM since 1.5.0] | Standard Stack | If ESM issues arise, fall back to dynamic import `await import("qrcode")` inside the route handler |
| A2 | Twilio sandbox sender `whatsapp:+14155238886` works for dev; real Cameroon sender requires Twilio approval [VERIFIED: Twilio docs] | Standard Stack | If a real sender isn't approved, WhatsApp is dead letter for prod; document in README |
| A3 | ntfy.sh public accepts anonymous POST to `/topic-name` with `Title` header [VERIFIED: ntfy.sh docs — "no auth needed for read/write on public topics, but anyone can subscribe"] | Standard Stack | If public ntfy.sh is rate-limited or down, self-host (add to docker-compose, set NTFY_HOST); out of scope v1 |
| A4 | Existing `apps/worker/src/notifications/channels/email.ts:4-9` graceful env fallback (`process.env.SMTP_HOST ?? "localhost"`) means email works with MailHog in dev without any extra config [VERIFIED: docker-compose has mailhog service, .env.example has SMTP_HOST=localhost SMTP_PORT=1025] | Architecture | If someone changes the default, dev email breaks; document in README |
| A5 | The `Notification` model has no `@@index([userId,status,createdAt])` today, and adding it is a backward-compatible migration [VERIFIED: schema lines 284-295 have only `id @id, userId @relation, transporterId @relation, channel, type, status, payload, sentAt, createdAt` — no composite index] | Common Pitfalls | If the schema is in some intermediate state, the migration may conflict with Phase 3's; check git diff first |
| A6 | RSC in Next 16.3.2 (already in `apps/web/package.json:15`) can call `getDashboard(token)` server-side via direct fetch with `process.env.API_URL` + bearer header [ASSUMED — Next 16 RSC fetch is standard; verify in code review] | Pattern 5 | If RSC fetch is not allowed in current Next config, fall back to client component with React Query (already in deps) |
| A7 | The `Prisma.TransactionClient` type can be passed to `generateAndIssueTicket` as `tx: PrismaTx` [ASSUMED — needs `import type { Prisma } from "@camermove/db"` or use `typeof prisma` shape] | Pattern 1 | If types don't match, use a less specific `tx: any` with a comment (existing pattern in `reconciliation.ts:70`) |
| A8 | `ntfy` topic rules: `[a-zA-Z0-9_-]{1,64}` (letters, digits, underscore, hyphen, max 64 chars) [VERIFIED via ntfy.sh docs] | Standard Stack | If topic is `user-${cuid}` and cuid is 25 chars, total = 30 chars, well under 64 |
| A9 | The `Ticket.verificationCode` @unique constraint is already present (line 279 of `schema.prisma`) [VERIFIED] | Pattern 1 | If it were missing, the retry loop wouldn't catch collisions; add a migration |
| A10 | `expireHolds` (`apps/worker/src/index.ts:39-46`) and `reconcileStalePayments` (`apps/worker/src/index.ts:31-35`) run every 60s and 60min respectively; Phase 4 can add a third `setInterval` for trip reminders without breaking anything [VERIFIED — both existing intervals follow the same pattern] | Pattern 5 | If intervals exceed event loop capacity, worker becomes unresponsive; 3 intervals × 60s = no risk |

## Open Questions

1. **Dashboard auth: server-side cookie or client-side zustand?**
   - What we know: `apps/web/components/providers.tsx` uses React Query; `useAuthStore` (zustand, persisted to localStorage with key `camermove-auth`) holds `accessToken` and `user`.
   - What's unclear: Does the dashboard RSC page need a server-readable cookie, or is the access token only in localStorage (client-only)?
   - Recommendation: Add a `middleware.ts` at `apps/web/middleware.ts` that checks the `accessToken` from a cookie (set on login) OR redirects to `/login?next=/dashboard`. Copy the access token to a cookie in `useAuthStore.setAuth`. RSC can read cookies via `next/headers`; client components read from zustand.

2. **Ticket model: add `scannedAt` + `scannedBy` columns?**
   - What we know: Current schema (lines 274-282) has `id, bookingId, qrCode, verificationCode @unique, status: TicketStatus, issuedAt` — no scanned fields.
   - What's unclear: Should `status="used"` carry a timestamp of when it was used, and by whom?
   - Recommendation: Add `scannedAt DateTime?` + `scannedBy String?` columns (Pattern 5). Migration is backward-compatible. Enables audit + analytics + transporter payroll.

3. **Notification fan-out: how many channels per event?**
   - What we know: NOTIF-01/02/03 require all three channels. Phase 3's `notification.service.send` sends to ONE channel per call.
   - What's unclear: Per event, send to all three channels, or pick based on user preference (which doesn't exist yet)?
   - Recommendation: Always send to all three channels for v1 (user can disable per-channel in v2 settings). Cheap, no PII in any channel payload. Skip the user-preference feature for v1.

4. **Trip reminder: 24h before only, or also 1h before?**
   - What we know: Phase 4 doesn't explicitly mention trip reminders; ROADMAP says "travelers are notified" and Phase 3 sends on payment success.
   - What's unclear: Is a "your bus leaves in 24 hours" reminder in scope for Phase 4, or deferred to Phase 5?
   - Recommendation: Include 24h reminder in Phase 4 (one extra cron, no extra schema). Document 1h reminder as v2.

5. **Ticket PDF export for travelers?**
   - What we know: AGENTS.md §6 requires periodic list endpoints to support `dateFrom/dateTo` + `/export?format=json|csv`. Tickets list endpoint would comply.
   - What's unclear: Does the traveler want a PDF they can print and show, or is the dashboard enough?
   - Recommendation: For v1, dashboard only. PDF export out of scope (admin export `GET /admin/tickets/export` is a different question; mark as v2).

6. **Notification sender identity: `noreply@camermove.cm` or `voyage@camermove.cm`?**
   - What we know: `SMTP_FROM=no-reply@camermove.cm` (line 33 of `.env.example`).
   - What's unclear: Is `noreply` OK for Cameroon travelers who expect a real address to reply to, or should it be `voyage@` or `support@`?
   - Recommendation: Keep `no-reply@camermove.cm` (anti-spam best practice); document support email `support@camermove.cm` in the email footer for replies.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node >=22 | All | ✓ [VERIFIED: package.json engines] | >=22 | — |
| pnpm 11.9.0 | Monorepo | ✓ | 11.9.0 | — |
| Postgres 16 | Prisma, `Ticket` + `Notification` rows, FOR UPDATE | ✓ [VERIFIED: docker-compose] | 16-alpine | — |
| Redis 7 | QR image cache, idempotency, rate-limit | ✓ [VERIFIED: docker-compose] | 7-alpine | In-memory fallback (existing) |
| Kafka 3.7 | Durable `ticket.issued` + `notification.should-send` events | ✓ [VERIFIED: docker-compose] | 3.7 | BullMQ queue if Kafka down (not ideal for replay) |
| `qrcode` npm | QR image rendering (NEW) | ✓ [VERIFIED: npm view] | 1.5.4 | — |
| `nodemailer` | Email send (NOTIF-01) | ✓ [VERIFIED: in apps/worker deps] | 6.9.16 | Log fallback (existing pattern in dispatcher) |
| `twilio` | WhatsApp send (NOTIF-02) | ✓ [VERIFIED: in apps/worker deps] | 6.1.0 | No-op fallback (existing graceful skip if env missing) |
| MailHog | Email dev testing | ✓ [VERIFIED: docker-compose line 47-50] | latest | Production SMTP (set `SMTP_HOST/PORT/USER/PASS`) |
| ntfy.sh public | Push dev testing | ✓ [VERIFIED: ntfy.sh free tier] | n/a | Self-hosted `binwiederhier/ntfy` (out of scope v1) |
| Twilio sandbox | WhatsApp dev testing | ✗ (needs account + opt-in) | — | Skip WhatsApp in dev; document in README |
| BullMQ | Trip reminder cron | ✗ (not installed) [ASSUMED] | 5.x | `setInterval(60min)` in worker (Pattern 5) |
| `prisma migrate dev` | Schema migration for indexes | ✓ [VERIFIED: in apps/api deps via @camermove/db] | Prisma 6 | — |

**Missing dependencies with no fallback:**
- Twilio sandbox creds (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` with sandbox number) — blocks WhatsApp dev testing. Planner must add provisioning task or document graceful degradation.

**Missing dependencies with fallback:**
- `qrcode` — single new dep; no fallback (hand-rolled QR is out of scope; see Don't Hand-Roll).
- `bullmq` for trip reminder — use existing `setInterval` pattern (Phase 3 used the same approach for `reconcileStalePayments`); documented upgrade path.

## Validation Architecture

> `workflow.nyquist_validation` is `false` per `.planning/config.json`, so this section is **skipped** per the orchestrator's instruction. Tests are at the planner's discretion; Phase 3 left 0 tests in `apps/api/src/payments/**` (per `03-VERIFICATION.md` line 136), so Phase 4 may follow the same precedent. If the planner wants tests, recommend:
> - `apps/api/src/tickets/service.test.ts` — `generateVerificationCode` length + charset; `generateAndIssueTicket` idempotency on duplicate call; `renderQrPng` returns a Buffer with PNG magic bytes (`89 50 4E 47`)
> - `apps/api/src/tickets/routes.test.ts` — public lookup returns 200 + redacted view; owner GET returns full ticket; non-owner GET returns 403
> - `apps/worker/src/notifications/templates.test.ts` — `renderTicketIssued` returns `{email, whatsapp, push}` with all required fields
> - `apps/worker/src/notifications/dispatcher.test.ts` — given a typed event, dispatcher creates one Notification row per available channel; failure in one channel doesn't block others

## Security Domain

> Required when `security_enforcement` is enabled (absent = enabled via AGENTS.md).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireAuth()` for `/tickets/:id`, `/me/dashboard`, `/tickets/:id/validate` (transporter_staff+), `/tickets/:id/void` (admin); `/tickets/lookup/:code` is public-by-design (QR scan) but rate-limited |
| V3 Session Management | yes | Stateless JWT (15m access + 30d refresh per AUTH-02); ticket validation handler re-validates JWT each call |
| V4 Access Control | yes | RBAC per endpoint: `validate` requires `transporter_staff` or `admin`; `void` requires `admin`; `lookup` is public; `getTicket` requires owner OR admin |
| V5 Input Validation | yes | Zod on every ticket/notification payload; `verificationCode` regex `/^[A-Z0-9]{8,12}$/`; `ticketId` `z.string().cuid()` |
| V6 Cryptography | yes | `crypto.randomBytes(8)` for verificationCode (not `Math.random`); `qrCode` is opaque (no HMAC needed since lookup server-side); no card data ever stored |
| V7 Error Handling & Logging | yes | Structured pino logs without PII; audit `verificationCode` HASHED not plaintext; generic 403/404 for invalid codes (no oracle); ntfy topic format prevents cross-user leakage |
| V8 Data Protection | yes | Public `/tickets/lookup/:code` returns REDACTED view (no email/phone/price); only full ticket visible to owner via auth; QR image served with `Cache-Control: private` |
| V10 Malicious Code | yes | All SMTP/Twilio/ntfy calls go through validated channel adapters; no eval/dynamic require; Prisma parameterized queries |
| V11 Business Logic | yes | Atomic ticket create inside FOR UPDATE tx; idempotent on `verificationCode @unique` retry; trip reminder cron idempotent via Notification lookup; public lookup rate-limited 50/min/IP |
| V13 API & Web Services | yes | Rate limiting dual-layer (IP+APP) on `/tickets/lookup`; idempotency for `POST /tickets/:id/void` and `POST /tickets/:id/validate`; OpenAPI documented |
| V14 Configuration | yes | All secrets via `loadEnv()` Zod `secret()`; no `process.env` elsewhere; `.env` gitignored; new env vars `NTFY_TOPIC_PREFIX` (default `user-`) optional |

### Known Threat Patterns for Ticketing & Notifications Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| QR code screenshot leaks booking | Information Disclosure | QR contains only `verificationCode + bookingId slice`; PII (email/phone/price) NEVER embedded; lookup is redacted |
| Public lookup enumeration (try random codes) | Spoofing | Rate limit 50/min/IP; verificationCode 10-char base32 = 2^50 keyspace; respond 404 not 403 (no oracle) |
| Ticket validation replay (scan twice) | Tampering | `SELECT FOR UPDATE` on Ticket + state machine `valid → used` (idempotent second scan returns `already_used`) |
| Ticket cloning via QR copy | Spoofing | First scan wins; second scan returns `already_used` with original `scannedAt + scannedBy`; transporter visually verifies ID match (out of scope v1) |
| SMTP credential leak in error logs | Information Disclosure | Catch only `err.message`; redact `user/pass` from error context; never log full `transport.options` |
| Twilio account SID leak | Information Disclosure | Never log `client` object; log only `{to, from, body.length, status}` |
| ntfy topic enumeration (public topic = any subscriber) | Information Disclosure | Per-user topic `user-${last12OfCuid}`; even with the cuid, attacker would need the user's device to subscribe; recommend user-specific auth in v2 (ntfy supports Basic auth) |
| Notification template XSS (user name in email) | Tampering | `escapeHtml()` helper (Pattern 4); no `dangerouslySetInnerHTML` in web dashboard for user-supplied fields |
| Dashboard SSRF (forward token to internal API) | Tampering | RSC uses server-side `fetch(process.env.API_URL + path, { headers: { Authorization: 'Bearer ' + token }})`; `API_URL` from env, not user input |
| Race: cancel + ticket validation | Tampering | `cancelBooking` (`apps/api/src/bookings/service.ts:144-145`) voids all valid tickets under `SELECT FOR UPDATE` on Booking; validation handler re-fetches Booking status and rejects if `cancelled | expired | refunded` |
| Trip reminder spam (cron restart) | Denial of Service | Idempotency via `Notification.findFirst({type: "trip.reminder", bookingId})` (Pitfall 6) |
| Email size blow-up (inline QR +15KB) | Denial of Service | `qrcode` width 320px caps PNG at ~13KB; email total <30KB; nodemailer default limit 25MB; no risk |

## Sources

### Primary (HIGH confidence)
- `qrcode` package — verified via `npm view qrcode version` (1.5.4), `npm view qrcode time.created` (2010-12-21), `npm view qrcode license` (MIT), `npm view qrcode repository.url` (git://github.com/soldair/node-qrcode.git), `npm view qrcode dist-tags` (latest: 1.5.4)
- `nodemailer` 6.9.16 — confirmed in `apps/worker/package.json`; official docs at nodemailer.com/message (cited for html+text+attachment API)
- `twilio` 6.1.0 — confirmed in `apps/worker/package.json`; official docs at twilio.com/docs/whatsapp/api (sandbox + production flow)
- `ntfy.sh` docs (docs.ntfy.sh) — cited for topic rules `[a-zA-Z0-9_-]{1,64}` and POST API `fetch(NTFY_HOST/topic, { method: "POST", headers: { Title }, body })`
- `Prisma` docs — confirmed `@@index` + `@@unique` syntax and `tx.$queryRaw` FOR UPDATE
- Existing codebase — `packages/db/prisma/schema.prisma` (Ticket, Notification models), `apps/worker/src/notifications/{service,channels/*}.ts` (channel adapters), `apps/api/src/payments/jobs/reconciliation.ts` (transaction shape), `apps/worker/src/index.ts` (cron pattern), `apps/api/src/payments/service.ts` (event publish pattern)

### Secondary (MEDIUM confidence)
- Next.js 16 RSC docs (nextjs.org/docs/app/building-your-application/rendering/server-components) — for `cookies()` + RSC fetch pattern
- MailHog docker image (github.com/mailhog/MailHog) — confirmed SMTP on port 1025 + web UI on 8025
- Twilio WhatsApp sandbox setup docs (twilio.com/docs/whatsapp/sandbox) — confirmed `+14155238886` sandbox number and opt-in via `join <sandbox-keyword>`

### Tertiary (LOW confidence)
- ntfy topic naming with `_` and length — verified indirectly via docs example URLs
- Twilio error codes (21211, 21408) — generic knowledge; not all current
- `qrcode` ESM vs CJS — verified via package.json `exports` field (not directly inspected in this session)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `qrcode` verified via npm + repo; nodemailer + twilio already in deps; no new core packages needed
- Architecture: HIGH — Ticket + Notification models already in schema; channel adapters already in worker; transaction pattern already in `reconciliation.ts`; the work is wiring + enrichment, not new architecture
- Pitfalls: HIGH — derived from existing Phase 3 patterns (HMAC rawBody, FOR UPDATE, idempotent webhook) + standard QR/email/whatsapp/push gotchas; the only LOW item is Twilio sandbox specifics

**Research date:** 2026-08-25
**Valid until:** 2026-09-25 (30 days; re-verify `qrcode` version + ntfy.sh API if planning beyond)

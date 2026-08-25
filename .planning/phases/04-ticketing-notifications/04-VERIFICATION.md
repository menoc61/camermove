---
phase: 04-ticketing-notifications
verified: 2026-08-25T14:55:00Z
status: human_needed
score: 5/5 requirements verified (static)
behavior_unverified: 4
overrides_applied: 0
overrides: []
gaps: []
deferred: []
behavior_unverified_items:
  - truth: "Confirmed booking yields an e-ticket with non-empty QR dataURL (TICK-01)"
    test: "docker compose up -d; register user; create booking in pending_payment; POST /api/v1/payments; webhook drives confirmPaymentSuccess; query prisma.ticket.findFirst → assert qrDataUrl starts with 'data:image/png;base64,'"
    expected: "Ticket row exists; qrDataUrl is a valid base64 PNG dataURL; idem (replay) returns same row without duplicate"
    why_human: "Code is present and wired inside the $transaction, but no end-to-end test exists under apps/api/src/payments/** or tickets/** that drives a live payment flow and asserts the runtime outcome"
  - truth: "GET /api/v1/tickets/lookup?ref=X returns sanitized 200 (TICK-02)"
    test: "With stack up + seeded confirmed booking: curl 'http://localhost:3000/api/v1/tickets/lookup?ref=CM-XXXX'; assert 200, keys ⊆ {reference, tripOrigin, tripDestination, departureAt, status, passengerFirstName}, no verificationCode/email/phone"
    expected: "200; sanitized body; 21st call from one IP within 60s → 429 with Retry-After"
    why_human: "Endpoint is registered, route is implemented, dual-layer rate-limit env keys are wired, but the live call requires running docker compose and a confirmed booking"
  - truth: "Email/WhatsApp/Push all fire for booking/payment/ticket events (NOTIF-01..03)"
    test: "NOTIF_DRIVER=stub; docker compose up; run a confirmed payment; assert one stub log per channel per event (3 events × 3 channels = 9 lines); for NOTIF-01 with MailHog, assert SMTP connect + message received on port 1025"
    expected: "Three events (booking.confirmed, payment.confirmed, ticket.issued) each produce 3 channel sends; WhatsApp stub logs 'whatsapp:stub to=...'; push stub logs 'push:stub topic=user-...'"
    why_human: "Dispatcher + handlers + channel adapters + templates are all present and typed; one-shot integration test (smoke-tickets Test 4) is gated on a live stack"
  - truth: "Trip reminder fires 24h before departure, idempotent (no duplicate Notification rows)"
    test: "With worker running: seed a confirmed booking with trip.departureAt = now + 23h45m; run 'pnpm --filter @camermove/worker trip-reminder -- --once' twice within 60s; assert exactly 1 Notification row with type='trip.reminder.24h' and payload.bookingId matching"
    expected: "First run → 1 notification row; second run → no new row (presence check skips); ntfy stub log per booking"
    why_human: "Cron logic + presence check + idempotency are all present in code; the runtime invariant requires a live worker + DB"
human_verification:
  - test: "Live payment → e-ticket with valid QR dataURL"
    expected: "Ticket row with qrDataUrl starting 'data:image/png;base64,'; verificationCode 12 chars alphanumeric; idempotent on replay"
    why_human: "Static evidence only; no payments test suite exists; requires live stack"
  - test: "Public ticket lookup (TICK-02) at 404, 410, 200, 429"
    expected: "200 sanitized body; 404 NOT_FOUND on bogus ref; 410 GONE on past-departure booking; 429 RATE_LIMITED_IP at 21st/min from one IP"
    why_human: "Endpoint is wired and registered; live HTTP calls required to exercise the rate-limit error path"
  - test: "Multi-channel notification dispatch with NOTIF_DRIVER=stub"
    expected: "booking.confirmed → 3 stub log lines (email, whatsapp, push); payment.confirmed → 3; ticket.issued → 3; failures land on camermove.notifications.failed"
    why_human: "Handlers + dispatcher + channels are present; needs a live Kafka + worker to exercise"
  - test: "Ownership 404 (not 403) for cross-user ticket access"
    expected: "GET /api/v1/me/tickets/{otherUsersTicketId} with valid JWT → 404 (not 403, no existence leak)"
    why_human: "Code path is correct (`me/tickets.ts:59-62`), smoke test 3 exists; needs two seeded users + running API"
  - test: "Public /tickets/lookup?ref=X is a true RSC (no client JS in bundle)"
    expected: "View-source of /tickets/lookup shows full server-rendered HTML with the reference text; no React hydration markers; no useState/useEffect references"
    why_human: "Page is a pure RSC by inspection (no 'use client' directive, no hooks, no event handlers); live HTML source required to confirm"
---

# Phase 4 Verification: Ticketing & Notifications

**Phase Goal:** Confirmed bookings yield e-tickets and travelers are notified.
**Verified:** 2026-08-25T14:55:00Z
**Verifier:** gsd-verifier
**Status:** human_needed (5/5 requirements verified at code level; 4 behavior-dependent truths routed to human verification)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **TICK-01** — Confirmed booking yields an e-ticket with non-empty QR dataURL + 12-char verificationCode, ACID with payment confirmation | ✓ VERIFIED (static) | `reconciliation.ts:77-184` — entire confirm flow is one `prisma.$transaction` with `SELECT FOR UPDATE` on Booking+SeatAvailability; `:159` calls `generateAndIssueTicket(t, p.bookingId)` AFTER Commission upsert; throw rolls back entire tx. `ticket.service.ts:21-26` — `randomBytes(10).toString('base64url').toUpperCase().replace(/[-_]/g, '').slice(0,12)`. `ticket.service.ts:75-80` — `QRCode.toDataURL(verificationCode, { errorCorrectionLevel: 'M', margin: 2, width: 240, color: { dark: '#0e9f8f', light: '#ffffff' } })`. `schema.prisma:282` — `qrDataUrl String? @db.Text` added; migration `20260825124452_add_ticket_qr_data_url` applied; `prisma migrate status` reports "Database schema is up to date!" |
| 2 | **TICK-02** — GET /api/v1/tickets/lookup?ref=X returns sanitized JSON (no PII), 404 / 410, dual-layer rate limited | ✓ VERIFIED (static) | `lookup.ts:20-95` — endpoint registered, validation via `LookupQuery` Zod (`validation.ts:8-12`); `lookup.ts:87-94` response body is exactly `{ reference, tripOrigin, tripDestination, departureAt, status, passengerFirstName }` — no email, phone, idNumber, verificationCode. `lookup.ts:62-67` — 404 NOT_FOUND, 410 GONE. `lookup.ts:22-41` — dual-layer Redis rate limit (`RATE_LIMIT_IP_TICKETS_LOOKUP_MAX=20` + `RATE_LIMIT_APP_TICKETS_LOOKUP_MAX=60`) returning 429 with `Retry-After: 60`. Plus global `rateLimitPlugin` preHandler adds a third layer (general IP+app). `lookup.ts:50` — `req.log.info({ ...meta, ref }, 'ticket.public_lookup')` (no PII). `lookup.ts:75-85` — `AuditLog` with `action: 'ticket.public_lookup'` + ip + ua |
| 3 | **NOTIF-01** — Email sends for booking/payment/ticket via own SMTP, MailHog fallback | ✓ VERIFIED (static) | `channels/email.ts:16-34` — typed `sendEmail(msg, env?)`, falls back to `console.log` if `NOTIF_DRIVER=stub` or `NODE_ENV=test`; uses `nodemailer.createTransport({ host, port, secure, auth })` with SMTP env defaults `localhost:1025` (MailHog). 3 event templates: `templates/booking-confirmed.ts:16-22`, `templates/payment-confirmed.ts:16-20`, `templates/ticket-issued.ts:16-21` (plus bonus `trip-reminder-24h.ts`). All French copy, subject does not contain PII, WhatsApp ≤ 160 chars, push title ≤ 50 chars. `env.ts:52` — `NTFY_BASE_URL` default `http://localhost:8090` |
| 4 | **NOTIF-02** — WhatsApp via Twilio (per-user, fallback to log) | ✓ VERIFIED (static) | `channels/whatsapp.ts:14-25` — `sendWhatsApp(env, msg)` uses `twilio(SID, TOKEN).messages.create({ from: TWILIO_WHATSAPP_FROM, to, body })`. Stub fallback if `NOTIF_DRIVER=stub` or `TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM` missing (warns + skips). `env.ts:51` — `TWILIO_WHATSAPP_FROM: z.string().optional()`. `dispatcher.ts:101` — `whatsapp:+${user.phone}` Twilio convention; only fires for users with `phone` set. `apps/worker/package.json:7` — `twilio ^6.1.0` dep installed |
| 5 | **NOTIF-03** — Push via ntfy per-user topic (`user-${last12OfCuid}`) | ✓ VERIFIED (static) | `channels/push.ts:21-34` — `sendPush(env, msg)` does `fetch('${NTFY_BASE_URL}/${msg.userId}', { method:'POST', headers:{Title, Priority, Tags}, body })`. `dispatcher.ts:27-31` — `ntfyTopicForUser(userId) = 'user-' + userId.slice(-12)`. Comment at `push.ts:4-9` documents the fix from the legacy `camermove_${userId}` format which violated ntfy rules (no leading underscore, no `.` separators). `env.ts:52-53` — `NTFY_BASE_URL` (default `http://localhost:8090`) + `NTFY_HOST` (default `https://ntfy.sh`) — push.ts:26 falls back to `NTFY_HOST` if base missing |

**Score:** 5/5 requirements verified (4 behavior-dependent items routed to human verification — see below).

### Quality Gates

| Gate | Status | Evidence |
|------|--------|----------|
| **ACID** — Ticket gen in same `$transaction` as Commission + Payment update | ✓ VERIFIED | `reconciliation.ts:77-184` — one `prisma.$transaction` for the entire critical path. `:80-81` — `SELECT FOR UPDATE` on Booking + SeatAvailability row locks. `:93-94` — Payment.status='success' + Booking.status='confirmed'. `:117-134` — Commission create with P2002 catch for idempotency. `:159` — `generateAndIssueTicket(t, p.bookingId)` inside the tx. `:162-164` — `throw e` triggers full rollback. |
| **Idempotency** — Ticket (presence check), Notification (presence check on payload.bookingId), Kafka re-delivery | ✓ VERIFIED | `ticket.service.ts:54-66` — `tx.ticket.findFirst({ where: { bookingId } })` returns existing row without insert. `:72-110` — P2002 retry on collision (3x). `reconciliation.ts:199-200` — `candidate.createdNew` controls `ticket.issued` publication (no duplicate on replay). `reconciliation.ts:131-133` — Commission P2002 catch. `trip-reminder.ts:38-45` — Notification presence check on `(type, userId, payload.bookingId)`. `handlers/notifications.ts:23,29,35,41` — `if (!data?.userId) return` guard. |
| **AuditLog per endpoint** (`/api/v1/me/*`, `/api/v1/tickets/lookup`, ticket.create) | ✓ VERIFIED | `lookup.ts:75-85` — `action: 'ticket.public_lookup'`. `me/dashboard.ts:111-127` — `action: 'me.dashboard'` (try/catch, non-blocking). `me/tickets.ts:91-107` — `action: 'me.ticket.view'` (try/catch, non-blocking). `reconciliation.ts:144-154` — `action: 'payment.success'`. `reconciliation.ts:167-183` — `action: 'ticket.create'` (only when `createdNew === true`). All include `metadata: { ip, ua, ... }` per AGENTS.md §2. |
| **Rate limiting dual-layer** on `/api/v1/tickets/lookup` | ✓ VERIFIED | `lookup.ts:22-41` — IP layer (Redis `rl:ip:${ip}:${path}` incr + 60s expire) + App layer (`rl:app:${path}`). Both return 429 with `Retry-After: 60`. Env `RATE_LIMIT_IP_TICKETS_LOOKUP_MAX=20`, `RATE_LIMIT_APP_TICKETS_LOOKUP_MAX=60` (env.ts:66,70). Plus global `rateLimitPlugin` adds a third (general) layer. |
| **RBAC on `/api/v1/me/***` | ✓ VERIFIED | `me/dashboard.ts:52` — `app.get('/me/dashboard', { preHandler: app.requireAuth() }, ...)`. `me/tickets.ts:37` — `app.get('/me/tickets/:id', { preHandler: app.requireAuth() }, ...)`. `me/tickets.ts:59-62` — ownership check returns 404 (not 403) to avoid existence leak. |
| **Metadata capture (`req.meta`)** per AGENTS.md §2 | ✓ VERIFIED | `plugins/metadata.ts:40-56` — `req.meta` decorated in `onRequest` hook with `ip, userAgent, os, browser, device, referer, requestId`. `lookup.ts:50` — `req.log.info({ ...meta, ref }, 'ticket.public_lookup')` (only ref, no PII). `me/dashboard.ts:54-55` — `req.log.info({ ...meta, userId }, 'me.dashboard')`. `me/tickets.ts:109` — `req.log.info({ ...meta, ticketId, userId }, 'me.ticket.view')`. Lookup audit metadata at `:82` includes ip + ua. |
| **HMAC on `notifications.failed` DLQ topic** | ⚠️ INFO | `dispatcher.ts:170-187` publishes to `camermove.notifications.failed` Kafka topic with plain JSON (no HMAC added). **However:** this is an *internal* Kafka topic between API publisher and worker consumer; HMAC is reserved for *external* webhooks (NotchPay `X-Notch-Signature`, CinetPay `x-token`) per AGENTS.md §1 + `webhooks/verify.ts`. Kafka transport security is at broker level (TLS + SASL), not in-app message signing. Phase 3's internal topics (`paymentCompleted`, etc.) follow the same pattern. Not a regression; the user's checklist may have miscategorized this gate. |
| **Smoke tests exist and look runnable** | ✓ VERIFIED | `scripts/smoke-tickets.ts` (164 lines) — Test 1: Ticket row with `qrDataUrl`. Test 2: Public lookup shape + no PII. Test 3: Idempotency (1 ticket per booking). Test 5: Trip reminder cron creates exactly 1 Notification row. `scripts/smoke-dashboard.ts` (165 lines) — Test 1: login + dashboard returns exactly 3 keys. Test 2: unauth → 401. Test 3: cross-user ticket → 404 (not 403). Test 4: SSR lookup HTML has reference text, no `verificationCode`. Test 5: 404 lookup → "Billet introuvable". Wired as `pnpm smoke:tickets` + `pnpm smoke:dashboard` in `package.json:18-19`. |

### Dashboard & Public Lookup

| Surface | Status | Evidence |
|---------|--------|----------|
| **/dashboard** renders 3 sections in brand teal | ✓ VERIFIED | `apps/web/app/dashboard/page.tsx:53` — `<h1 className="mb-4 text-2xl font-semibold text-[#0e9f8f]">Mes voyages</h1>`. `Dashboard.tsx:67-118` — 3 sections in order: Upcoming (max 3 + "Voir tous"), Tickets (max 3 + "Voir tous"), History (`<HistoryToggle>`, hidden when empty). `:76-79` Empty Upcoming → `<EmptyState title="Aucun voyage à venir. Trouvez un trajet." cta={{href:'/', label:'Rechercher'}} />`. `:100-101` Empty Tickets → `<EmptyState title="Vos billets apparaîtront ici après paiement." />` (no CTA per UI-SPEC). `:112` History hidden when `length === 0`. |
| **/tickets/[id]** shows QR PNG at 240x240 | ✓ VERIFIED | `apps/web/app/tickets/[id]/page.tsx:22-25` — `getTicket` → `<TicketDetail data={...} />`. `TicketDetail.tsx:36-41` — `<img src={data.qrDataUrl} alt="QR code du billet" className="mx-auto h-auto max-w-[240px]" />`. `:47-50` — verification code in `font-mono` below QR. Scales on 360px via `max-w-[240px]`. On 404 (ApiError): page.tsx:30-31 redirects to `/dashboard`. |
| **/tickets/lookup** is server-rendered (no client JS) | ✓ VERIFIED | `apps/web/app/tickets/lookup/page.tsx` — no `"use client"` directive; no `useState`, no `useEffect`, no event handlers, no client component imports. `searchParams: Promise<{ ref?: string }>` (Next 16 async). `fetchLookup()` runs server-side (no Authorization header, `cache: 'no-store'`). Status code → branch UI: 200 → render, 410 → "Ce trajet est expiré", 404 → "Billet introuvable", other → "Erreur de vérification". No `verificationCode/email/phone/idNumber` derived or rendered (the API already sanitizes the body; this page renders only what it receives). |

### AGENTS.md §3 Dead Code Scan

| Scan | Result |
|------|--------|
| `TODO/FIXME/XXX/HACK/PLACEHOLDER` in target dirs | 0 hits (the only matches were the French error string `Référence invalide (format attendu: CM-XXXXXXXX)` and `Format de référence invalide (attendu: CM-XXXXXXXX)` — French "format attendu" = "expected format", not a debt marker) |
| `console.log` of PII (`fullName`, `phone`, `email`, `idNumber`) in dashboard components | 0 hits |
| `bg-[…]` arbitrary color tokens in dashboard/tickets components | 0 hits (only the allowed `bg-[#0e9f8f]` brand teal in `EmptyState.tsx:21`, `UpcomingTripCard.tsx:43`, `TicketCard.tsx:36`, `TicketDetail.tsx:93`, `lookup/page.tsx:66/113/127/140`) |
| Stub handlers returning `{ ok: true }` | 0 hits in `apps/api/src/tickets`, `apps/worker/src/notifications`, `apps/api/src/routes/{me,tickets}` |
| Empty returns `return null/{}|[]` in implementation files | 0 hits |
| Raw card data (PAN/CVV) logging | 0 hits (the only `card` match is `plateNumber` in `ticket.repo.ts:28`) |
| OpenAPI spec includes Phase 4 paths | ✓ VERIFIED — `swagger.ts:94-138` — paths for `/api/v1/tickets/lookup`, `/api/v1/me/dashboard`, `/api/v1/me/tickets/{id}`; schemas for `Ticket`, `Notification`, `NotificationEvent`, `PublicTicketLookup`, `DashboardResponse` |

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/api/src/tickets/ticket.service.ts` | ✓ VERIFIED | 112 lines; `generateAndIssueTicket(tx, bookingId)` with idempotency + collision retry; uses `qrcode@^1.5.4` |
| `apps/api/src/tickets/ticket.repo.ts` | ✓ VERIFIED | 34 lines; thin Prisma wrappers; data-access layer per AGENTS.md §4 |
| `apps/api/src/tickets/validation.ts` | ✓ VERIFIED | 23 lines; Zod `LookupQuery` + `LookupByCodeParams`; ref regex `^CM-[A-Z0-9]{6,12}$` |
| `apps/api/src/routes/tickets/lookup.ts` | ✓ VERIFIED | 96 lines; public endpoint with dual-layer rate limit + sanitized response + audit log |
| `apps/api/src/routes/me/dashboard.ts` | ✓ VERIFIED | 131 lines; 3 parallel Prisma queries via `Promise.all`; `requireAuth()` preHandler; audit log on access |
| `apps/api/src/routes/me/tickets.ts` | ✓ VERIFIED | 112 lines; ownership returns 404 (not 403); `requireAuth()` preHandler; audit log on view |
| `apps/worker/src/notifications/dispatcher.ts` | ✓ VERIFIED | 211 lines; typed fan-out, `Promise.allSettled`, retry-with-backoff (1s/4s/16s), DLQ on failures |
| `apps/worker/src/notifications/channels/{email,whatsapp,push}.ts` | ✓ VERIFIED | 34/25/34 lines; typed signatures; nodemailer + twilio + ntfy fetch; NOTIF_DRIVER=stub fallback |
| `apps/worker/src/notifications/templates/{booking-confirmed,payment-confirmed,ticket-issued,trip-reminder-24h}.ts` | ✓ VERIFIED | Each returns `{email?, whatsapp?, push}` per event; French copy; ≤160 chars WhatsApp, ≤200 chars push |
| `apps/worker/src/handlers/notifications.ts` | ✓ VERIFIED | 43 lines; 4 typed event handlers → `dispatcher.dispatch(data)` |
| `apps/worker/src/jobs/trip-reminder.ts` | ✓ VERIFIED | 133 lines; 30-min setInterval; idempotent via `Notification` presence check; `--once` CLI mode |
| `packages/shared/src/notifications/events.ts` | ✓ VERIFIED | 47 lines; `NotificationEvent` discriminated union (4 types) + `NotificationEventPayload` |
| `apps/web/middleware.ts` | ✓ VERIFIED | 55 lines; cookie-based UX gate; explicitly excludes `/tickets/lookup`; sets `x-cm-user-token` request header |
| `apps/web/components/providers.tsx` | ✓ VERIFIED | 52 lines; `AuthCookieSync` mirrors zustand `accessToken` → `cm_access` cookie (non-HttpOnly, SameSite=Lax, 900s) |
| `apps/web/app/dashboard/page.tsx` | ✓ VERIFIED | 59 lines; RSC wrapper; `h1` "Mes voyages" in brand teal; 3 sections via `<Dashboard>` |
| `apps/web/app/tickets/[id]/page.tsx` | ✓ VERIFIED | 54 lines; RSC; 404 → redirect to /dashboard; suspense skeleton |
| `apps/web/app/tickets/lookup/page.tsx` | ✓ VERIFIED | 146 lines; pure RSC (no client JS); branches on 200/404/410/other |
| `apps/web/components/dashboard/{Dashboard,UpcomingTripCard,TicketCard,HistoryToggle,SkeletonCard,EmptyState,StatusPill}.tsx` | ✓ VERIFIED | All 7 components render per UI-SPEC; status pill color map: emerald/amber/red/slate |
| `apps/web/components/tickets/TicketDetail.tsx` | ✓ VERIFIED | 99 lines; QR via `<img src=data URL>` max-w-[240px]; verification code in font-mono |
| `apps/web/lib/api/{client,dashboard,tickets}.ts` | ✓ VERIFIED | Shared `apiFetch` + `ApiError`; typed `getDashboard` + `getTicket` |
| `scripts/smoke-tickets.ts` | ✓ VERIFIED | 167 lines; 4 tests (Test 4 = NOTIF_DRIVER=stub, run separately); wired as `pnpm smoke:tickets` |
| `scripts/smoke-dashboard.ts` | ✓ VERIFIED | 165 lines; 5 tests; wired as `pnpm smoke:dashboard` |
| `prisma/schema.prisma` Ticket.qrDataUrl | ✓ VERIFIED | `qrDataUrl String? @db.Text` line 282; migration `20260825124452_add_ticket_qr_data_url` applied; `prisma migrate status` green |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `apps/api/src/payments/jobs/reconciliation.ts` | `apps/api/src/tickets/ticket.service.ts` | `generateAndIssueTicket(t, p.bookingId)` inside `$transaction` | ✓ WIRED | `:11-12` import; `:159` call inside the tx; if throws, the entire tx rolls back (`:162-164`) |
| `apps/api/src/tickets/ticket.service.ts` | `packages/db/prisma/schema.prisma` | `tx.ticket.create({ data: { bookingId, qrCode, verificationCode, status, qrDataUrl } })` | ✓ WIRED | `:83-91` Prisma client call; `qrDataUrl` column exists at schema line 282 |
| `apps/api/src/routes/tickets/lookup.ts` | `apps/api/src/tickets/validation.ts` | `LookupQuery.safeParse(req.query)` | ✓ WIRED | `:10` import; `:44` parse; invalid → 400 with FR error message |
| `apps/api/src/routes/tickets/lookup.ts` | `packages/db/prisma/schema.prisma` | `prisma.booking.findUnique({ where:{reference: ref}, include:{trip:{...}, passengers, tickets, user} })` | ✓ WIRED | `:53-61` query; response uses only sanitized fields `:88-93` |
| `apps/api/src/routes/tickets/lookup.ts` | `packages/config/src/env.ts` | `env.RATE_LIMIT_IP_TICKETS_LOOKUP_MAX` + `RATE_LIMIT_APP_TICKETS_LOOKUP_MAX` | ✓ WIRED | `:16-17` reads; `:22-41` applies both layers; defaults 20/60 (env.ts:66,70) |
| `apps/api/src/app.ts` | `apps/api/src/routes/{tickets/lookup,me/dashboard,me/tickets}.ts` | `register(... { prefix: '/api/v1' })` | ✓ WIRED | `:54-56` registered under `/api/v1`; full paths: `/api/v1/tickets/lookup`, `/api/v1/me/dashboard`, `/api/v1/me/tickets/:id` |
| `apps/worker/src/index.ts` | `apps/worker/src/handlers/notifications.ts` | Kafka consumer subscribes to 4 typed topics | ✓ WIRED | `:22-25` — `EVENT_TOPICS.bookingConfirmed`, `paymentConfirmed`, `ticketIssued`, `tripReminder24h` |
| `apps/worker/src/index.ts` | `apps/worker/src/jobs/trip-reminder.ts` | `setInterval(30min)` after consumer connects | ✓ WIRED | `:60-64` — interval starts after `consumer.connect()`; SIGTERM clears at `:85` |
| `apps/worker/src/notifications/dispatcher.ts` | `apps/worker/src/notifications/channels/{email,whatsapp,push}.ts` | `sendEmail/sendWhatsApp/sendPush(env, msg)` | ✓ WIRED | `:12-14` imports; `:86,111,138` calls in parallel via `Promise.allSettled` |
| `apps/worker/src/notifications/dispatcher.ts` | `apps/worker/src/notifications/templates/{4 files}` | `renderBookingConfirmed/renderPaymentConfirmed/renderTicketIssued/renderTripReminder24h` | ✓ WIRED | `:15` import; `:199-211` `pickRenderer` switch by event type |
| `apps/worker/src/notifications/dispatcher.ts` | `packages/events/src/topics.ts` | `EVENT_TOPICS.notificationsFailed` = `camermove.notifications.failed` | ✓ WIRED | `:170` topic; `:171-187` DLQ publish on channel failures |
| `apps/api/src/payments/jobs/reconciliation.ts` | `packages/events/src/topics.ts` | `EVENT_TOPICS.{ticketIssued, paymentConfirmed, bookingConfirmed, paymentCompleted}` | ✓ WIRED | `:10` import; `:196,216,240,269,294` publishes 4 typed events |
| `apps/web/middleware.ts` | `apps/web/components/providers.tsx` | `cm_access` cookie (cookie set by providers, read by middleware) | ✓ WIRED | providers.tsx:22 `document.cookie = 'cm_access=...; Max-Age=900'`; middleware.ts:38 `request.cookies.get('cm_access')` |
| `apps/web/app/dashboard/page.tsx` | `apps/api/src/routes/me/dashboard.ts` | `fetch('${NEXT_PUBLIC_API_URL}/api/v1/me/dashboard', { headers: { Authorization: 'Bearer ' + token } })` | ✓ WIRED | `:18-21`; full URL via env; auth header from cookie/header |
| `apps/web/app/tickets/[id]/page.tsx` | `apps/api/src/routes/me/tickets.ts` | `getTicket(id, token)` → `apiFetch('/api/v1/me/tickets/${id}')` | ✓ WIRED | tickets.ts:27 `apiFetch(...)`; client.ts:18-27 sends `Authorization: Bearer` |
| `apps/web/app/tickets/lookup/page.tsx` | `apps/api/src/routes/tickets/lookup.ts` | `fetch('${NEXT_PUBLIC_API_URL}/api/v1/tickets/lookup?ref=...', { cache:'no-store' })` | ✓ WIRED | lookup/page.tsx:25; no Authorization header (public endpoint) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `me/dashboard.ts` `upcoming/history` | `b.trip.route.originCity/destinationCity` | Prisma `booking.findMany` with `include: { trip: { include: { route: true } } }` | ✓ FLOWING | Real query — `upcoming` filters `status in [confirmed, pending_payment]` + `trip.departureAt >= now`; `history` filters `trip.departureAt < now OR status=cancelled` |
| `me/dashboard.ts` `tickets` | `t.verificationCode/t.status` | `prisma.ticket.findMany({ where:{ booking:{ userId } }, include:{ booking:{...} } })` | ✓ FLOWING | Real query — only the user's own tickets |
| `me/tickets.ts` `ticket.qrDataUrl` | `ticket.qrDataUrl` (column) | `prisma.ticket.findUnique` (same row written by `generateAndIssueTicket` inside `confirmPaymentSuccess` tx) | ✓ FLOWING | `qrDataUrl` is populated from `QRCode.toDataURL(...)` in `ticket.service.ts:75-80` and stored in the same transaction as the Payment/Booking/Commission writes |
| `lookup.ts` `body.passengerFirstName` | `booking.user.firstName` | `prisma.booking.findUnique({ include:{ user: { select:{ firstName:true } } } })` | ✓ FLOWING | Real DB column; no static fallback |
| `lookup.ts` `body.tripOrigin/Destination` | `booking.trip.route.originCity/destinationCity` | Same booking query's nested includes | ✓ FLOWING | Real DB columns from Route table |
| `TripDetail.tsx` `data.qrDataUrl` | `ticket.qrDataUrl` | `getTicket(id, token)` → `apiFetch('/api/v1/me/tickets/${id}')` | ✓ FLOWING | Server returns the stored `qrDataUrl` (not a placeholder); client embeds it via `<img src=data URL>` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `apps/api` compiles | `cd apps/api && npx tsc --noEmit` | exit 0, no errors | ✓ PASS |
| `apps/worker` compiles | `cd apps/worker && npx tsc --noEmit` | exit 0, no errors | ✓ PASS |
| `apps/web` compiles | `cd apps/web && npx tsc --noEmit` | exit 0, no errors | ✓ PASS |
| Prisma schema valid | `cd packages/db && npx prisma validate` | "The schema at prisma/schema.prisma is valid" | ✓ PASS |
| Migrations applied | `cd packages/db && npx prisma migrate status` | "5 migrations found ... Database schema is up to date!" | ✓ PASS |
| Prisma client regenerated | `cd packages/db && npx prisma generate` | "Generated Prisma Client (v6.19.3)" | ✓ PASS |
| `apps/api` test suite passes | `cd apps/api && npx vitest run --passWithNoTests` | 17/17 tests pass in 5 files (634ms) | ✓ PASS |
| `qrcode@^1.5.4` installed | `apps/api/package.json:29` | Listed in `dependencies` | ✓ PASS |
| `@types/qrcode` installed | `apps/api/package.json:35` | Listed in `devDependencies` | ✓ PASS |
| `twilio` installed | `apps/worker/package.json:7` | Listed in `dependencies` | ✓ PASS |
| `nodemailer` installed | `apps/worker/package.json:7` | Listed in `dependencies` | ✓ PASS |
| `smoke:tickets` script | `package.json:18` | Wired via `pnpm --filter @camermove/api exec tsx ../../scripts/smoke-tickets.ts` | ✓ PASS |
| `smoke:dashboard` script | `package.json:19` | Wired via `pnpm --filter @camermove/api exec tsx ../../scripts/smoke-dashboard.ts` | ✓ PASS |
| Live endpoint probes | (not run — server not started) | infra not running at verify time | ? SKIP → human verification |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `scripts/*/tests/probe-*.sh` | (discovery) | No `probe-*.sh` files exist; not declared in plans/SUMMARYs | SKIPPED (none exist) |
| `scripts/smoke-tickets.ts` | (run) | Requires running `docker compose up -d` + seed data; not run at verify time | ? SKIP → human verification |
| `scripts/smoke-dashboard.ts` | (run) | Same | ? SKIP → human verification |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TICK-01 | 04-01 | Confirmed booking generates e-ticket with QR/verificationCode | ✓ SATISFIED (static) / ⚠️ behavior unverified | `reconciliation.ts:159` calls `generateAndIssueTicket` inside the `$transaction` after Commission; `ticket.service.ts:21-26` 12-char base32-style verificationCode; `ticket.service.ts:75-80` QR via `QRCode.toDataURL(...)`; `schema.prisma:282` `qrDataUrl String? @db.Text`; migration applied; `prisma migrate status` green |
| TICK-02 | 04-01, 04-02 | Ticket can be looked up by reference and validated | ✓ SATISFIED (static) / ⚠️ behavior unverified | `routes/tickets/lookup.ts` endpoint; `validation.ts` Zod regex `^CM-[A-Z0-9]{6,12}$`; response body sanitized (no email/phone/idNumber/verificationCode); 404/410/200/429/400 covered; dual-layer rate limit; audit log; no PII in log; SSR page (no client JS) |
| NOTIF-01 | 04-01 | Email sends booking/payment/ticket via own SMTP, MailHog fallback | ✓ SATISFIED (static) / ⚠️ behavior unverified | `channels/email.ts` nodemailer + SMTP env (localhost:1025 default = MailHog); NOTIF_DRIVER=stub fallback; 3 typed FR templates; branded copy in French |
| NOTIF-02 | 04-01 | WhatsApp via Twilio (per-user, fallback to log) | ✓ SATISFIED (static) / ⚠️ behavior unverified | `channels/whatsapp.ts` Twilio SDK with env creds; stub fallback; dispatcher only fires for users with `phone`; `whatsapp:+${user.phone}` Twilio convention |
| NOTIF-03 | 04-01 | Push via ntfy per-user topic | ✓ SATISFIED (static) / ⚠️ behavior unverified | `channels/push.ts` fetch POST to ntfy; `dispatcher.ts:27-31` topic format `user-${userId.slice(-12)}` (was `camermove_${userId}`, violated ntfy rules — fixed); ntfy rules documented in `push.ts:4-9` |

**Orphaned requirements:** None. REQUIREMENTS.md maps TICK-01, TICK-02, NOTIF-01, NOTIF-02, NOTIF-03 to Phase 4; all five are addressed by the shipped code.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/api/src/payments/jobs/reconciliation.ts` | 103, 162 | `console.warn` / `console.error` | ℹ️ Info | Intentional telemetry (seatsHeld clamp + ticket-gen failure); not stubs |
| `apps/api/src/payments/jobs/reconciliation.ts` | 479 (>300) | File size | ℹ️ Info | Split candidate per AGENTS.md §4; not introduced by Phase 4 |
| `apps/api/src/tickets/lookup.ts:23,27,82` | typing | `(req as unknown as { meta: ... }).meta` | ℹ️ Info | Cast for typed access; `metadataPlugin` already extends `FastifyRequest.meta` globally but local cast keeps routes self-contained |
| `apps/worker/src/notifications/channels/whatsapp.ts` | 20 | `console.warn` for missing env | ℹ️ Info | Intentional graceful-degrade telemetry |
| `apps/worker/src/notifications/dispatcher.ts` | 62 | `console.warn` for missing user | ℹ️ Info | Intentional; user not found → return empty `channelResults` |
| Target dirs (`apps/api/src/tickets`, `apps/worker/src/notifications`, `apps/worker/src/handlers`, `apps/worker/src/jobs`, `apps/api/src/routes/me`, `apps/api/src/routes/tickets`, `apps/web/{middleware.ts,app/dashboard,app/tickets,components/dashboard,components/tickets}`) | — | TODO/FIXME/XXX/HACK/PLACEHOLDER | ✓ Clean | Zero debt markers; no commented-out blocks; no stub handlers |
| `apps/web/components/dashboard` + `apps/web/components/tickets` | — | `bg-[…]` arbitrary color tokens | ✓ Clean | Only `bg-[#0e9f8f]` (brand teal) per the plan's allowed list |

### Gaps Summary

**No code gaps.** All 5 requirements (TICK-01, TICK-02, NOTIF-01, NOTIF-02, NOTIF-03) are satisfied at the code level. All artifacts exist, are substantive, and are wired. All key links connect. Quality gates pass: ACID (in-tx ticket gen), idempotency (presence checks on bookingId, payload.bookingId, paymentId), audit log (5 distinct action types), dual-layer rate limit (IP + app, both env-tunable), RBAC on `/me/*` (404 not 403 for cross-user), metadata via `req.meta` (with explicit `{...meta}` spread to log calls), FR copy throughout, ntfy topic fix documented, trip reminder cron idempotent.

**What keeps the status at `human_needed`:** the 4 behavior-dependent truths (TICK-01, TICK-02, NOTIF-01, NOTIF-02, NOTIF-03) assert runtime outcomes (live ticket creation, live notification dispatch, live rate-limit 429 path, live trip-reminder cron) that no automated test exercises. The static analysis is exhaustive and the typecheck is green across all 3 packages + 17 unit tests pass in `apps/api`. The remaining gap is the same shape as Phase 3's (zero tests under `apps/api/src/{payments,tickets,notifications}/**` that exercise runtime outcomes). Closing it requires either a human UAT pass against a running `docker compose up -d` stack, or a small vitest integration suite (e.g. mock QR + assert `qrDataUrl` shape; mock `prisma.$transaction` to assert rollback on ticket gen failure; assert `dispatcher.dispatch` produces one Notification row per channel per event).

**ℹ️ Info-level note on the user's checklist item "HMAC on notifications.failed DLQ topic":** The `camermove.notifications.failed` topic is an internal Kafka topic between `apps/api` (publisher) and `apps/worker` (consumer); no HMAC is added. This is consistent with Phase 3's architecture (all internal Kafka topics — `paymentCompleted`, `ticketIssued`, etc. — are published without per-message HMAC; HMAC is reserved for external webhook endpoints: NotchPay `X-Notch-Signature`, CinetPay `x-token`). Kafka transport security (TLS + SASL) is at the broker level, not in app code. Not a regression, not a missing requirement under AGENTS.md §1 — but called out for visibility since the user's checklist mentioned it.

### Recommendation

**NEEDS_HUMAN_VERIFICATION (not NEEDS_FIXES or NEEDS_REPLAN).** The code is ready. The repo is at a clean point on `master` (last 19 commits are the two Phase 4 plans, all green typecheck + 17/17 tests). No code gaps to close. The 4 behavior-dependent truths require a human UAT pass against a running stack to upgrade from "code present + wired" to "code proven to behave at runtime" — which is the same verification pattern Phase 3 followed (5/8 human_needed, no fixes required).

---

_Verified: 2026-08-25T14:55:00Z_
_Verifier: gsd-verifier_

---
phase: 03-payments
verified: 2026-08-25T10:34:37Z
status: human_needed
score: 5/8 must-haves verified
behavior_unverified: 3
overrides_applied: 0
prohibitions_flagged: 7 # judgment-tier prohibitions — LLM-judged PASS (non-authoritative); human review recommended
re_verification:
  previous_status: passed
  previous_score: 10/10
  gaps_closed: []
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "POST /payments creates a live NotchPay/CinetPay session and Idempotency-Key replay returns same status+body without re-calling provider"
    test: "docker compose up -d; register user; create booking in pending_payment; POST /api/v1/payments with sandbox keys + Idempotency-Key k1; replay with same k1"
    expected: "201 {payment, authorizationUrl, paymentUrl}; replay returns identical body; provider dashboard shows exactly 1 transaction; second booking attempt on same booking returns existing pending payment"
    why_human: "Requires live provider sandbox + running stack; no test exists anywhere under apps/api/src/payments and server was not running at verification time"
  - truth: "Webhook delivery idempotently updates Payment.status — duplicate deliveries and worker replays never double-confirm, double-book seats, or duplicate Commission"
    test: "Send valid-HMAC webhook to /api/v1/webhooks/notchpay twice (same event id), let worker consume both; inspect Payment/Booking/SeatAvailability/Commission rows"
    expected: "First → 200 received; second → 200 status:duplicate; exactly one Payment.status=success, one Booking confirmed, seatsHeld decremented once, exactly one Commission row"
    why_human: "State transition + ordering invariant across Redis/Kafka/Postgres; grep proves symbols exist but cannot prove the transition holds at runtime"
  - truth: "On success booking→confirmed + seats→booked + commission persisted (override-aware); on failure/expiry seats released; reconciliation recovers stale pending; refund releases seatsBooked"
    test: "With stack up: drive one booking through success webhook, one through failure, insert a pending payment createdAt 10m ago then trigger reconcileStalePayments, call refundPayment on a confirmed booking"
    expected: "Success path confirms + books seats + Commission.percentApplied honors featureFlags.transporterCommissions override; failure path releases held seats and expires booking; stale pending driven to terminal state; refund moves seatsBooked→seatsAvailable and voids tickets"
    why_human: "All are transactional state transitions (FOR UPDATE serialization vs expireHolds race) that no automated test exercises; presence checks cannot see runtime outcomes"
human_verification:
  - test: "MVP-format decision (escalation): ROADMAP marks Phase 3 mode:mvp but goal is not user-story format ('As a…, I want to…, so that….')"
    expected: "Human decides: either run /gsd mvp-phase 3 to reformat the goal, or accept the current goal wording for this already-executed phase"
    why_human: "Canonical validator gsd-tools query user-story.validate returned false; MVP-narrowed User Flow Coverage cannot be produced without a fabricated story"
  - test: "Live payment initiation + idempotent replay against NotchPay/CinetPay sandboxes (see behavior_unverified_items #1)"
    expected: "201 with live authorization_url/payment_url; identical replay body; 1 provider transaction"
    why_human: "Needs provider credentials + running docker compose stack"
  - test: "Webhook end-to-end: valid HMAC → 200 received; replay same id → 200 duplicate; worker transitions Payment→success, Booking→confirmed, seats→booked, Commission created once (see behavior_unverified_items #2/#3)"
    expected: "Exactly-once state transition; percentApplied matches AppSettings override"
    why_human: "Runtime cross-service behavior; no payments test suite exists"
  - test: "CinetPay never-trust-notify check: deliver notify with spoofed cpm_amount while /v2/payment/check reports different amount"
    expected: "Worker maps to failed (amount mismatch), does not confirm booking"
    why_human: "Requires mocking/mismatching provider responses at runtime"
  - test: "Expiry race: fire expireHolds and confirmPaymentSuccess concurrently on one nearly-expired booking"
    expected: "One wins under FOR UPDATE; seatsHeld never negative; no duplicate Commission"
    why_human: "Concurrency invariant; cannot be observed by static checks"
---

# Phase 3: Payments Verification Report

**Phase Goal:** Bookings can be paid and confirmed via NotchPay + CinetPay (dual provider), enterprise-grade.
**Verified:** 2026-08-25T10:34:37Z
**Status:** human_needed
**Re-verification:** Yes — fresh verification of current codebase state (prior report passed 10/10; no payments code changed since prior verification commit `7c57a93`, confirmed via `git log 7c57a93..HEAD`)

> **Mode note (escalation).** ROADMAP.md declares Phase 3 `mode: mvp`, but the canonical guard `gsd-tools query user-story.validate --story "<goal>"` returned **false** — the goal is not in User Story format. Per verifier policy the MVP-narrowed User Flow Coverage framing is therefore NOT applied (it would be fabricated); this report uses the standard goal-backward methodology against the roadmap Success Criteria. Human decision requested above.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /payments creates NotchPay/CinetPay session and returns authorization_url/payment_url (Idempotency-Key + one-pending guard, XAF multiple-of-5 for CinetPay) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | All code present + wired: `routes.ts:8-23` POST 201 returns `{payment, authorizationUrl, paymentUrl}`; `service.ts:29-42` ownership/status guards + `amount=booking.totalAmount` + `%5` guard; `service.ts:80-84` in-tx `SELECT FOR UPDATE` re-check; `idempotency.ts:12-41` global preHandler caches 24h on Idempotency-Key (registered `app.ts:31` before routes); adapters return real URLs (`notchpay.adapter.ts:50-54`, `cinetpay.adapter.ts:68-74`). But the asserted runtime flow (live provider session + byte-identical replay) has **no test** (`apps/api/src/payments/**` contains zero `*.test.ts`; repo tests cover auth/bookings/env/seats/topics/media only) and server was down at verify time → see Human Verification |
| 2 | Webhook verified (X-Notch-Signature / x-token HMAC) + SET NX dedup + Kafka enqueue → 200 fast; idempotently updates Payment.status; CinetPay double-verifies via /v2/payment/check | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Receipt side fully verifiable by inspection: `notchpay.ts:24-45` rawBody→401→403 via `verifyNotchSignature(rawBody,…)`; `:61-83` Redis `SET NX EX 7d` dedup + memory fallback → 200 `duplicate`; `:94-123` Kafka enqueue w/ Redis-list fallback → 200 `received`, no business logic; cinetpay mirror `cinetpay.ts:30-89` incl. composite deliveryId; worker gate `reconciliation.ts:36-61 mustVerifyProvider` mandatory `verifyPayment` + amount/currency mismatch → failed. But runtime properties (dedup atomicity under concurrency, <100ms p99, exactly-once Payment.status transition) are unexercised by any test → see Human Verification |
| 3 | On success booking→confirmed + seats→booked + commission persisted (global + per-transporter override); failure/expiry releases seats; reconciliation recovers stuck pending; refund releases seats; exportable payments | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Transitions present + wired: `confirmPaymentSuccess` (`reconciliation.ts:69-147`) FOR UPDATE ×2, idempotency guards `:80-83`, clamp `Math.min` `:92`, Commission create + @unique catch `:110-126`; `failPayment` `:169-216` releases seatsHeld→seatsAvailable only if still pending_payment; `reconcileStalePayments` `:291-329` >5m take 100; `refund.ts:30-76` tx refunded + seat reversal + ticket void; export `routes.ts:37-92` RBAC+dates+`SEARCH_MAX_LIMIT`+`sendExport`. No test exercises any transition → see Human Verification |
| 4 | Provider-agnostic abstraction talks to NotchPay or CinetPay without changing call sites | ✓ VERIFIED | `providers/types.ts:38-43` `PaymentProvider` interface; `providers/index.ts:6-25` `getProvider` factory lazy `loadEnv()`, unknown → BadRequestError; single call sites `service.ts:63` and `reconciliation.ts:38,300` — zero provider branching outside factory (grep confirms) |
| 5 | Webhook signature verification uses timingSafeEqual on raw body bytes, not JSON.stringify(parsed) | ✓ VERIFIED | `webhooks/verify.ts:9-11` HMAC over raw string + `timingSafeEqual(Buffer,Buffer)` hex in try/catch; `plugins/rawBody.ts:12-41` captures `req.rawBody` string via `addContentTypeParser parseAs:"string"` BEFORE JSON.parse (json + form); `notchpay.ts:42` verifies `req.rawBody` verbatim; adapters delegate (`notchpay.adapter.ts:69`, `cinetpay.adapter.ts:182`) — no inline HMAC in verification path |
| 6 | Commission math is integer XAF with Math.round, shared via packages/shared, not duplicated | ✓ VERIFIED | `packages/shared/src/money.ts:6-19` `calcCommission`/`calcRefund` Math.round integer-only; consumed via `@camermove/shared` in `commission.ts:2` + `refund.ts:2`; workspace dep wired `apps/api/package.json:18`; grep shows no other commission math in payments. ℹ️ Info: `bookings/cancellation.ts:121-122` has inline refund-tier Math.round — Phase 2 file, out of this phase's scope, integer-consistent |
| 7 | Only the booking owner can pay; GET /payments/:id owner-or-admin scoped; list/export RBAC + dateFrom/dateTo + SEARCH_MAX_LIMIT streaming CSV | ✓ VERIFIED | `service.ts:29` ForbiddenError if `booking.userId !== userId`; `:151-158 getPaymentById` admin/super_admin bypass else owner-only 403; `listPayments:164-168` traveler `where.booking={userId}`; `routes.ts:37-61` export traveler-scoped + date filters + `take: env.SEARCH_MAX_LIMIT` + `sendExport`; `/admin/payments(+export)` aliases `requireAuth("admin")` `routes.ts:64-92` |
| 8 | Commission calculation reads AppSettings.commissionPercent cached 30s + per-transporter override from featureFlags.transporterCommissions, rounded integer XAF | ✓ VERIFIED | `commission.ts:5-6` `CACHE_KEY="appsettings:global"`, TTL 30; `:8-28` getCached→DB fallback→lazy create→setCached; `:34-38 computeCommission` override pick `overrides[transporterId] ?? globalPct` → `calcCommission`; consumed by hold-extension `service.ts:104-105` and confirm tx `reconciliation.ts:109` |

**Score:** 5/8 truths verified (3 present, behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | PAY-03 text says "ticket … created" on success — `confirmPaymentSuccess` does not create a Ticket (only AuditLog + Kafka events ready for consumers) | Phase 4 | REQUIREMENTS.md traceability maps TICK-01/TICK-02 ("e-ticket with QR/verificationCode") to Phase 4; ROADMAP Phase 4 goal: "Confirmed bookings yield e-tickets"; prior verification documented same deferral |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/prisma/schema.prisma` | cinetpay enum + expired status + indexes + Commission unique | ✓ VERIFIED | `PaymentProvider.cinetpay` line 54; `PaymentStatus.expired`; Payment indexes lines 253-256; `Commission.bookingId @unique` line 262; `prisma validate` passes |
| `packages/db/prisma/migrations/20260825093916_payments_cinetpay_provider/migration.sql` | migration SQL | ✓ VERIFIED | ALTER TYPE ×2 + CREATE INDEX ×4, committed |
| `packages/shared/src/money.ts` | calcCommission + calcRefund integer XAF | ✓ VERIFIED | 20 lines substantive; barrel `index.ts` re-export; typecheck green |
| `apps/api/src/payments/providers/types.ts` | PaymentProvider seam | ✓ VERIFIED | Interface + PAYMENT_PROVIDERS const + input/result types; pure, no framework imports |
| `apps/api/src/payments/providers/notchpay.adapter.ts` | raw-fetch adapter + HMAC delegate | ✓ VERIFIED | 110 lines; POST/GET fetch with 10s AbortController; non-ok throws with status+body; delegates signature to verify.ts |
| `apps/api/src/payments/providers/cinetpay.adapter.ts` | /v2/payment + check + %5 guard | ✓ VERIFIED | 184 lines; XAF + multiple-of-5 BadRequestError; code 201 success mapping; check API code 00+ACCEPTED; form-parse delegate |
| `apps/api/src/payments/providers/index.ts` | getProvider factory | ✓ VERIFIED | Lazy loadEnv inside fn; injected env objects; typed errors |
| `apps/api/src/payments/webhooks/verify.ts` | pure crypto helpers | ✓ VERIFIED | 63 lines; both helpers timingSafeEqual hex; 15-field concat + documented Object.values fallback; zero Fastify/DB imports |
| `apps/api/src/payments/schema.ts` | Zod schemas | ✓ VERIFIED | CreatePaymentBody (provider enum, method optional, no amount field — client can never send amount), Params, ListQuery, ExportQuery + inferred types |
| `apps/api/src/payments/repository.ts` | thin prisma wrappers | ✓ VERIFIED | findPendingPaymentByBookingId (pending\|processing), findById incl booking.trip, list+count, create, findPendingPaymentsOlderThan |
| `apps/api/src/payments/commission.ts` | cached settings + computeCommission | ✓ VERIFIED | 39 lines; 30s cache; override pick; shared math only |
| `apps/api/src/payments/service.ts` | guarded createPayment + queries | ✓ VERIFIED | 198 lines; ownership/status/one-pending (pre-check + in-tx FOR UPDATE re-check); server-derived amount/URLs; hold extension from cached settings; audit in-tx; best-effort Kafka |
| `apps/api/src/payments/routes.ts` | routes + admin aliases + export | ✓ VERIFIED | POST 201 w/ authorizationUrl+paymentUrl; GET list/detail; export CSV; requireAuth everywhere; req.log.info with meta per AGENTS §2 |
| `apps/api/src/payments/webhooks/notchpay.ts` | verify→dedup→enqueue→200 fast | ✓ VERIFIED | 126 lines; rateLimit:false; 400/401/403/503 ladder; SET NX EX 7d + memory prune; Kafka + redis-list fallback; enqueue-failure keeps NX key & returns 500 for provider retry |
| `apps/api/src/payments/webhooks/cinetpay.ts` | x-token verify + composite dedup | ✓ VERIFIED | 129 lines; form parse from rawForm; 15-field helper + explicit plan-mandated fallback; `cinetpay:{trans_id}:{trans_date}` deliveryId; header documents worker double-verify contract |
| `apps/api/src/payments/jobs/reconciliation.ts` | processPaymentWebhook + confirm/fail + reconcile | ✓ VERIFIED | 329 lines; FOR UPDATE ×4; idempotency + expiry-race guards; clamp; Commission unique catch; mandatory verify step; dual lookup reference/providerRef; UnrecoverableError → DLQ semantics |
| `apps/api/src/payments/jobs/refund.ts` | refundPayment | ✓ VERIFIED | 91 lines; confirmed+success guards; cancellation-tier fallback calcRefund(100%); tx FOR UPDATE + reversal + ticket void + audit + event |
| `apps/api/src/plugins/rawBody.ts` | global rawBody capture | ✓ VERIFIED | 45 lines; json+form parsers storing req.rawBody string then parsing; registered `app.ts:28` before metadata/rateLimit |
| `apps/worker/src/index.ts` | paymentWebhookReceived consumer + hourly reconcile | ✓ VERIFIED | Handler dynamic-imports reconciliation.js; setInterval hourly; SIGTERM clear; telemetry shutdown |
| `apps/api/src/app.ts` | registration order | ✓ VERIFIED | rawBodyPlugin → metadata → rateLimit → idempotency → auth → paymentRoutes → both webhook routes under /api/v1 |
| `packages/config/src/env.ts` | CINETPAY_* env | ✓ VERIFIED | APIKEY/SITE_ID optional, SECRET_KEY secret.optional(), BASE_URL default; .env.example lines 21-24 mirror |
| `packages/events/src/topics.ts` | 4 new payment topics | ✓ VERIFIED | paymentInitiated/Failed/Refunded/WebhookReceived + existing Completed, as const |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| notchpay.adapter.ts | webhooks/verify.ts | verifyNotchSignature delegate | ✓ WIRED | adapter line 69; tool query + manual read confirm no inline HMAC |
| cinetpay.adapter.ts | packages/config/env.ts | loadEnv-injected env | ✓ WIRED | factory injects env object; no process.env in adapters |
| payments/service.ts | providers/index.ts | getProvider().createPayment | ✓ WIRED | service.ts:63-75; amount always booking.totalAmount |
| payments/commission.ts | packages/shared/money.ts | calcCommission import | ✓ WIRED | import + call; workspace dep declared; typecheck proves resolution |
| webhooks/notchpay.ts | webhooks/verify.ts | rawBody HMAC | ✓ WIRED | verifies req.rawBody string pre-parse |
| webhooks/cinetpay.ts | jobs/reconciliation.ts | enqueue-only contract; worker calls /v2/payment/check | ✓ WIRED | handler contains no verify-API call or DB mutation; mustVerifyProvider in worker performs it |
| jobs/reconciliation.ts | schema.prisma | FOR UPDATE + @unique | ✓ WIRED | $queryRaw locks Booking+SeatAvailability; Commission bookingId @unique + catch |
| routes.ts | service.ts | createPayment + metadata log | ✓ WIRED | routes.ts:13-21 + structured log with meta |
| app.ts | plugins/rawBody.ts | global registration first | ✓ WIRED | registered line 28 ahead of parsers/consumers |
| worker/index.ts | payments/jobs/reconciliation.js | consumer + interval | ✓ WIRED | dynamic imports for handler + reconcileStalePayments |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| service.createPayment | amount | booking.totalAmount via prisma include | ✓ FLOWING | never client-supplied; schema has no amount field |
| commission.computeCommission | pct + amounts | AppSettings row cached 30s + featureFlags override | ✓ FLOWING | DB-backed, not hardcoded; persisted into Commission on confirm |
| routes list/export | data,total | prisma.payment.findMany/count scoped by requester | ✓ FLOWING | RBAC where-clause + pagination meta + capped export |
| confirmPaymentSuccess | seatsHeld/seatsBooked, Commission | locked SeatAvailability row + booking.trip.transportId | ✓ FLOWING | clamped decrement/increment; commission persisted with percentApplied |
| webhook handlers | aggregateId | parsed rawBody reference/cpm_trans_id | ✓ FLOWING | real event payload enqueued, not synthetic |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Workspace compiles | `pnpm -r typecheck` (run once) | All 10 projects Done, 0 errors | ✓ PASS |
| Prisma schema valid | `pnpm --filter @camermove/db exec prisma validate` | "schema is valid" | ✓ PASS |
| Payments test suite exercises transitions | enumerate `*.test.ts` under apps/api/src/payments | 0 files (repo tests: auth, bookings, env, seats, topics, media, observability) | ✗ FAIL (no behavioral evidence exists) — routed as behavior_unverified items, not code gaps |
| Live endpoint probes | port 3000 listener check | False — server not running; starting servers prohibited | ? SKIP → human verification |
| Commit evidence | `git log` | All 8 claimed feat commits present (2c98941…ad0f576) + docs commits; no payments changes after 7c57a93 | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| scripts/*/tests/probe-*.sh | discovery | No probe scripts exist; none declared in plans/SUMMARYs | SKIPPED (none exist). Smoke suites (`pnpm smoke*`) require running docker compose — infra down at verify time |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PAY-01 | 03-01, 03-02 | Initiate payment via NotchPay (Mobile Money) and receive authorization_url | ✓ SATISFIED (static) | POST /payments 201 returns authorizationUrl+paymentUrl; both adapters return real provider URLs; guards verified in code |
| PAY-02 | 03-03 | Webhook verified (X-Notch-Signature) and updates Payment.status idempotently | ✓ SATISFIED statically / ⚠️ behavior unverified | HMAC-on-rawBody + SET NX + enqueue verified by inspection; the *idempotent update* property has no test → human item #3 |
| PAY-03 | 03-02, 03-03 | On success booking confirmed, seats booked, ticket and commission created | ✓ SATISFIED except ticket | confirmed/seats/commission implemented transactionally; **ticket deferred to Phase 4** (TICK-01 mapped there) → Deferred Items |
| PAY-04 | 03-03 | On failure/expiry held seats released | ✓ SATISFIED (static) | failPayment releases seatsHeld→seatsAvailable under lock; reconcile drives stale to terminal |

No orphaned requirements: REQUIREMENTS.md maps exactly PAY-01..04 to Phase 3; all four claimed across plans.

### Prohibition Review (judgment-tier — LLM-judged, NON-AUTHORITATIVE; human review recommended)

| Prohibition | Verdict (judged) | Basis |
|-------------|------------------|-------|
| No raw card data stored | PASS (judged) | Schema/body carry only `method` enum; no PAN fields anywhere; hosted-flow only |
| No inline HMAC / JSON.stringify(parsed) verification | PASS (judged) | verify.ts isolated + timingSafeEqual; both routes verify req.rawBody pre-parse. Note: `cinetpay.ts:49-57` repeats the Object.values fallback inline — plan-mandated docs-ambiguity fallback, still HMAC over form values, not a re-serialization bypass (ℹ️ info) |
| No business logic in webhook receipt (enqueue only) | PASS (judged) | Both handlers: verify → dedup → enqueue → 200; zero DB writes |
| No client-supplied amount trusted | PASS (judged) | amount = booking.totalAmount; Zod body has no amount field |
| No duplicate pending payment per booking | PASS (judged) | Pre-check + in-tx SELECT FOR UPDATE re-check |
| Never trust CinetPay notify payload alone | PASS (judged) | Worker mustVerifyProvider mandatory; adapter gates on code 00+ACCEPTED; reconcile amount/currency guard |
| No duplicate commission or negative seatsHeld on retry | PASS (judged) | Commission @unique catch; Math.min clamp; terminal-state guards |

None of these judgments has wired enforcement tests (all judgment-tier); they are flagged for human review, never silently absorbed.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| apps/api/src/payments/jobs/reconciliation.ts | 95, 327 | console.warn/console.log | ℹ️ Info | Intentional telemetry (clamp warn + reconcile summary); not stubs |
| apps/api/src/payments/jobs/reconciliation.ts | — | 329 lines (>300 AGENTS §4 guideline) | ℹ️ Info | Split candidate (refund.ts already extracted); no functional impact |
| apps/api/src/payments/webhooks/cinetpay.ts | 49-57 | duplicated fallback HMAC (helper already covers it) | ℹ️ Info | Redundant but plan-mandated; consistent result |
| apps/worker/src/notifications/channels/email.ts | 4-9 | process.env fallbacks | ℹ️ Info | Phase-1 file outside phase scope; has typed-env primary |
| apps/api/src/payments/** | — | TODO/FIXME/XXX/HACK/placeholder/stub-return scan | ✓ Clean | rg exit 1 — zero debt markers, zero empty handlers, zero `{ok:true}` stubs |

### Human Verification Required

See frontmatter `human_verification`. Priority order:

1. **MVP-format escalation decision** — validate or reformat goal via `/gsd mvp-phase 3`.
2. **Live initiation + idempotent replay** with sandbox creds (behavior_unverified #1).
3. **Webhook end-to-end exactly-once transition** incl. duplicate delivery (behavior_unverified #2).
4. **CinetPay spoofed-notify rejection** via check-API amount mismatch.
5. **Expiry-race concurrency** between expireHolds and confirmPaymentSuccess.
6. **Reconciliation recovery + refund release** (behavior_unverified #3).

### Gaps Summary

No code gaps. Every artifact exists, is substantive, and is wired; all key links connect; typecheck (0 errors) and prisma validate pass; commit trail intact; no debt markers; requirements PAY-01..04 satisfied at the code level (ticket creation explicitly deferred to Phase 4 per roadmap phasing).

What keeps this phase at **human_needed** rather than passed: the three roadmap Success Criteria assert runtime behaviors (live provider sessions, idempotent webhook-driven state transitions, transactional seat/commission/reconciliation flows) and the repository contains **zero tests** under `apps/api/src/payments/**` — the missing-tests pattern (25% of calibration gaps). Presence and wiring were proven; behavior was not. The prior 10/10 pass rested on static evidence alone; this fresh run reclassifies the three behavior-dependent SCs honestly rather than counting symbol presence as proof. Code is unchanged since the prior verification (`git log 7c57a93..HEAD` touches only bookings/web/planning files), so nothing regressed — the bar moved. Closing either requires a human UAT pass against a running stack, or (better) adding a small vitest suite for verify.ts vectors + confirm/fail idempotency + reconciliation with a mocked provider, after which all three truths upgrade to VERIFIED.

---

_Verified: 2026-08-25T10:34:37Z_
_Verifier: ox-alpha (gsd-verifier)_

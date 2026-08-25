---
phase: 03-payments
plan: 02
subsystem: payments
tags: [payments, notchpay, cinetpay, zod, prisma, idempotency, rbac, export, commission]
requires:
  - phase: 03-01
    provides: [PaymentProvider seam NotchPay/CinetPay adapters, HMAC verifiers, Payment prisma cinetpay enum, shared money helpers, event topics]
provides:
  - Idempotent POST /payments with ownership + pending_payment + one-pending guard calling provider adapters server-derived XAF amount
  - GET /payments + GET /payments/:id owner-or-admin scoped + GET /payments/export and /admin/payments with date filters and SEARCH_MAX_LIMIT streaming CSV
  - computeCommission with 30s Redis cached AppSettings and per-transporter override via featureFlags.transporterCommissions
  - Zod schemas CreatePaymentBody PaymentParams PaymentListQuery and thin payment repository
affects: [03-03 webhooks, 03-04 reconciliation, frontend payment flow, admin payments table]
tech-stack:
  added: []
  patterns: ["one-pending-per-booking guard with SELECT FOR UPDATE deduplication", "server-derived amount never trust client", "cached AppSettings 30s for commission and hold extension", "exportable payments via sendExport with RBAC"]
key-files:
  created:
    - apps/api/src/payments/schema.ts
    - apps/api/src/payments/repository.ts
    - apps/api/src/payments/commission.ts
    - apps/api/src/payments/service.ts
    - apps/api/src/payments/routes.ts
  modified:
    - apps/api/src/app.ts
    - apps/api/package.json
key-decisions:
  - "Wire @camermove/shared workspace dep to fix commission import — required for calcCommission reuse"
  - "One-pending guard returns existing payment without re-calling provider; tx re-check with SELECT FOR UPDATE on Booking prevents race on double-click"
  - "Amount derived solely from booking.totalAmount; CinetPay multiple-of-5 validated before provider call mapped to 400"
  - "Hold extension if <5min remaining via getAppSettingsCached holdExpiryMinutes, done inside same tx as payment create"
  - "Kafka paymentInitiated publish best-effort non-blocking — catch and ignore failures to keep request path fast"
  - "Admin aliases /admin/payments + /admin/payments/export with requireAuth(admin) satisfy AGENTS.md §2 metadata while keeping /payments RBAC"
patterns-established:
  - "Payment service holds invariants (ownership, status, one-pending, amount) — controllers thin"
  - "Repository stays pure Prisma wrappers, no throw — service decides errors with typed AppError"
  - "Commission reads global commissionPercent + featureFlags.transporterCommissions override then calcCommission integer XAF"
requirements-completed: [PAY-01, PAY-03]
duration: 3min
completed: 2026-08-25
status: complete
---

# Phase 03 Plan 02: Payment Initiation + Query Surface Summary

**Idempotent POST /payments behind RBAC + Idempotency-Key + one-pending guard calling NotchPay/CinetPay via server-derived XAF amount, with owner-or-admin GET /payments/:id, paginated list, CSV export respecting SEARCH_MAX_LIMIT, and cached commission with per-transporter override**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-25T10:46:12Z
- **Completed:** 2026-08-25T10:48:47Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Zod schemas for payments (CreatePaymentBody with provider/method/phone/email, PaymentParams cuid, PaymentListQuery with status/provider/date/q/orderBy, PaymentExportQuery) parsing correctly and throwing ZodError on invalid provider
- Thin payment repository: findPaymentById with booking.trip include, findPendingPaymentByBookingId (pending|processing), listPayments with count, createPaymentRecord, findPendingPaymentsOlderThan for reconciliation
- computeCommission and getAppSettingsCached with 30s Redis cache via getCached/setCached, fallback create-if-missing AppSettings global, integer XAF via calcCommission and transporter override from featureFlags.transporterCommissions
- Guarded createPayment enforcing booking exists, owner-only, pending_payment status, one-pending deduplication (pre-check + tx SELECT FOR UPDATE), XAF currency hardcode, CinetPay amount%5, server-derived callbackUrl/notifyUrl and channel mapping, provider call via getProvider, tx payment create + hold extension + AuditLog, best-effort Kafka paymentInitiated publish
- listPayments and getPaymentById with traveler-scoped vs admin-scoped RBAC, dateFrom/dateTo on createdAt, q search on providerRef/booking.reference, orderBy parsing, pagination meta total/totalPages
- Payment routes: POST /payments 201 with authorizationUrl+paymentUrl and metadata logging, GET /payments, GET /payments/:id, GET /payments/export and /admin/payments aliases with RBAC + SEARCH_MAX_LIMIT streaming CSV via sendExport + Content-Disposition, Idempotency-Key replay handled by global idempotencyPlugin 24h
- App registration: paymentRoutes registered under /api/v1 after bookingRoutes preserving plugin order (metadata→rateLimit→idempotency→auth)

## Task Commits

Each task was committed atomically:

1. **Task 1: Zod schemas + repository + commission reader** - `608811b` (feat)
2. **Task 2: Payment service — guarded createPayment + queries** - `59aacee` (feat)
3. **Task 3: Payment routes + App registration (idempotency + metadata + export)** - `cd55958` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `apps/api/src/payments/schema.ts` - Zod CreatePaymentBody, PaymentParams, PaymentListQuery, PaymentExportQuery with inferred types
- `apps/api/src/payments/repository.ts` - Thin Prisma wrappers for payment find/list/create, one-pending guard helper, reconciliation query
- `apps/api/src/payments/commission.ts` - getAppSettingsCached 30s Redis + setCached, computeCommission with override picking calcCommission
- `apps/api/src/payments/service.ts` - createPayment with ACID guards, server-derived XAF amount, provider dispatch, tx hold extension + audit, Kafka publish; plus getPaymentById and listPayments with RBAC
- `apps/api/src/payments/routes.ts` - POST /payments, GET /payments, GET /payments/:id, GET /payments/export, GET /admin/payments aliases with RBAC/metadata/export
- `apps/api/src/app.ts` - Imports and registers paymentRoutes under /api/v1 after bookingRoutes
- `apps/api/package.json` - Adds @camermove/shared workspace dep for calcCommission
- `pnpm-lock.yaml` - Lockfile updated for shared workspace link

## Decisions Made

- Added @camermove/shared to apps/api deps — commission.ts needs calcCommission; without workspace link typecheck fails. Follow AGENTS.md shared math principle.
- One-pending guard dual layer: fast pre-check via findPendingPaymentByBookingId before provider call (avoids double charge), plus tx re-check with SELECT FOR UPDATE on Booking before insert to handle concurrent double-click race.
- Never trust client amount: amount = booking.totalAmount server-side; XAF hardcode; CinetPay multiple-of-5 validated pre-provider with BadRequestError 400 mapping.
- Callback/notify URLs derived from loadEnv API_URL / FRONTEND_URL with camermove.cm fallback; notifyUrl is /api/v1/webhooks/{provider} per RESEARCH distinct provider URLs.
- Hold extension threshold 5 min matches RESEARCH Pitfall 4; reads holdExpiryMinutes from cached AppSettings (30s TTL) instead of hardcode, per AGENTS.md §5.
- Kafka publish is fire-and-forget: connect/send/disconnect each wrapped in .catch(()=>{}) so provider/payment creation never fails due to Kafka unavailability; preserves AGENTS.md async decoupling without blocking request.
- Kept methodToChannels mapping simple (mobile_money→MOBILE_MONEY, card→CREDIT_CARD, bank_transfer→WALLET, else ALL) to satisfy adapter channels param.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @camermove/shared workspace dependency**
- **Found during:** Task 1 (commission.ts typecheck)
- **Issue:** commission.ts imports calcCommission from @camermove/shared but apps/api package.json did not declare the workspace dep — pnpm -r typecheck failed TS2307 cannot find module
- **Fix:** Added "@camermove/shared": "workspace:*" to apps/api/package.json and ran pnpm install to link workspace
- **Files modified:** apps/api/package.json, pnpm-lock.yaml
- **Verification:** pnpm -r typecheck passes 0 errors across 11 workspaces
- **Committed in:** 608811b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for correctness — without the dep the commission module cannot compile. No scope creep.

## Issues Encountered

- Prisma generate EPERM not encountered this plan; typecheck initially failed on missing shared dep — resolved inline as deviation above.

## User Setup Required

None - no external service configuration required. CINETPAY_* and NOTCHPAY_* remain optional per 03-01; payment initiation will fail at runtime if provider keys missing, which is expected until credentials are provisioned. Documented in .env.example.

## Next Phase Readiness

- Payment initiation + query surface ready for 03-03 webhook handling (HMAC verify + enqueue + worker state machine); service exposes createPayment and getProvider seam that webhooks will reuse for verification
- Commission helper ready for worker to persist Commission on payment success; AppSettings cache pattern established
- One-pending guard and export RBAC ready; frontend can integrate POST /payments with Idempotency-Key and GET /payments/export datepicker
- No blockers — pnpm -r typecheck 0 errors, routes registered, idempotency global plugin covers replay

---
*Phase: 03-payments*
*Completed: 2026-08-25*

## Self-Check: PASSED

- [x] `apps/api/src/payments/schema.ts` exports CreatePaymentBody
- [x] `apps/api/src/payments/repository.ts` exports findPendingPaymentByBookingId
- [x] `apps/api/src/payments/commission.ts` exports computeCommission and getAppSettingsCached
- [x] `apps/api/src/payments/service.ts` exports createPayment and enforces one-pending guard
- [x] `apps/api/src/payments/routes.ts` exports paymentRoutes with POST /payments and GET /payments/export
- [x] `apps/api/src/app.ts` registers paymentRoutes
- [x] `git log --oneline --grep="03-02"` shows 3 commits (608811b, 59aacee, cd55958)
- [x] `pnpm -r typecheck` passes 0 errors

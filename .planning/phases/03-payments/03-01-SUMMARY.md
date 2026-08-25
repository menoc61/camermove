---
phase: 03-payments
plan: 01
subsystem: payments
tags: [payments, notchpay, cinetpay, hmac, prisma, zod, fetch]
requires:
  - phase: 02-booking-core
    provides: [Booking model, seat hold, AppSettings, event backbone]
provides:
  - PaymentProvider seam with NotchPay and CinetPay adapters via raw fetch
  - Isolated HMAC verifiers using timingSafeEqual on raw body
  - Prisma Payment extended with cinetpay enum, expired status, indexes
  - Typed CINETPAY env vars and shared integer XAF money helpers
  - Extended event topics for payment lifecycle
affects: [03-02 payment initiation, 03-03 webhooks, 03-04 reconciliation, frontend payment flow]
tech-stack:
  added: ["@camermove/shared package"]
  patterns: ["PaymentProvider strategy interface", "isolated HMAC verify helpers", "raw fetch adapters with AbortController 10s"]
key-files:
  created:
    - packages/shared/src/money.ts
    - packages/shared/src/index.ts
    - packages/shared/package.json
    - apps/api/src/payments/providers/types.ts
    - apps/api/src/payments/providers/index.ts
    - apps/api/src/payments/providers/notchpay.adapter.ts
    - apps/api/src/payments/providers/cinetpay.adapter.ts
    - apps/api/src/payments/webhooks/verify.ts
    - packages/db/prisma/migrations/20260825093916_payments_cinetpay_provider/migration.sql
  modified:
    - packages/db/prisma/schema.prisma
    - packages/config/src/env.ts
    - packages/events/src/topics.ts
    - .env.example
key-decisions:
  - "Raw fetch only — no notchpay-api/cinetpay SDK (SUS/SLOP flagged in RESEARCH) to keep control and auditability"
  - "HMAC isolated in verify.ts delegates via timingSafeEqual hex — adapters never inline crypto"
  - "CinetPay x-token fallback to Object.values join per docs ambiguity, preserves compatibility"
  - "Shared money helpers in packages/shared with Math.round integer XAF, single source for commission/refund"
  - "Factory lazy-loads env via loadEnv() inside getProvider for test mockability"
patterns-established:
  - "PaymentProvider interface with createPayment/verifyPayment/verifyWebhookSignature contract"
  - "Provider adapters use AbortController 10s timeout and never log secrets"
  - "CinetPay amount multiple-of-5 and XAF guard throws BadRequestError for 400 mapping"
requirements-completed: [PAY-01]
duration: 25min
completed: 2026-08-25
status: complete
---

# Phase 03 Plan 01: Payments Foundation Summary

**Dual-provider PaymentProvider seam with NotchPay/CinetPay raw-fetch adapters, isolated timingSafeEqual HMAC verifiers, Prisma cinetpay enum + indexes, typed CinetPay env, and integer XAF shared money math**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-25T09:19:00Z
- **Completed:** 2026-08-25T09:44:16Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Extended Prisma Payment model: `PaymentProvider.cinetpay`, `PaymentStatus.expired`, indexes on `(status,createdAt)`, `(provider,providerRef)`, `(bookingId,status)`, `(providerRef)` with migration generated
- Added typed env `CINETPAY_APIKEY/SITE_ID/SECRET_KEY/BASE_URL` via `secret.optional()` pattern, updated `.env.example`
- Created `packages/shared` with `calcCommission`/`calcRefund` integer XAF helpers exported via barrel
- Extended `EVENT_TOPICS` with `paymentInitiated`, `paymentFailed`, `paymentRefunded`, `paymentWebhookReceived`
- Built `PaymentProvider` interface and `getProvider` factory registry with lazy `loadEnv()` and `BadRequestError` for unknown provider
- Implemented isolated HMAC verifiers `verifyNotchSignature`/`verifyCinetToken` using `timingSafeEqual` hex and 15-field concat fallback
- Implemented `NotchPayAdapter` and `CinetPayAdapter` via native fetch, 10s AbortController, XAF guards, and delegation to verify helpers

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema + config + shared money + event topics** - `2c98941` (feat)
2. **Task 2: PaymentProvider interface + factory registry** - `f81b35c` (feat)
3. **Task 3: Isolated HMAC verifiers + both provider adapters (raw fetch)** - `b7fc512` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `packages/db/prisma/schema.prisma` - Added cinetpay enum value, expired status, Payment indexes with comment guard
- `packages/db/prisma/migrations/20260825093916_payments_cinetpay_provider/migration.sql` - Migration for provider/status enums + indexes
- `packages/config/src/env.ts` - Added CINETPAY_* optional secrets via `secret.optional()` + default base URL
- `packages/shared/src/money.ts` - Integer XAF `calcCommission` and `calcRefund` helpers
- `packages/shared/src/index.ts` - Barrel export for shared package
- `packages/events/src/topics.ts` - Added 4 payment lifecycle topics
- `apps/api/src/payments/providers/types.ts` - PaymentProvider seam types and interfaces
- `apps/api/src/payments/providers/index.ts` - Factory `getProvider` with lazy env
- `apps/api/src/payments/providers/notchpay.adapter.ts` - NotchPay fetch adapter with HMAC delegation
- `apps/api/src/payments/providers/cinetpay.adapter.ts` - CinetPay adapter with amount guard + check API verification
- `apps/api/src/payments/webhooks/verify.ts` - Pure crypto helpers isolated
- `.env.example` - Documented CINETPAY env vars

## Decisions Made

- No SDK installation per RESEARCH Package Legitimacy Audit — raw fetch keeps auditability and avoids SUS/SLOP packages
- Keep `Commission.bookingId @unique` unchanged — relies on DB guard against duplicate commission on webhook replay
- Use `secret.optional()` for CinetPay keys (not `z.string().optional()`) to preserve secret validation semantics when provided
- CinetPay verifyPayment maps `code==="00" && status==="ACCEPTED"` success, `REFUSED`→failed, else pending — documented for worker to gate state transitions
- Factory uses direct `loadEnv()` import called inside function — satisfies lazy-load for test mockability without brittle require hack

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Prisma generate initially failed with EPERM on query_engine DLL due to running node processes — resolved by killing node and regenerating.
- Task 2 factory imports adapters not yet implemented — created placeholder adapters that throw, then fleshed out in Task 3 to keep typecheck green.

## User Setup Required

None - no external service configuration required for this foundation plan. CINETPAY_* env vars are optional until provider credentials are obtained; documented in `.env.example`. NotchPay keys remain required.

## Next Phase Readiness

- PaymentProvider seam ready for 03-02 service/route layer to call `getProvider().createPayment` without branching
- HMAC helpers ready for 03-03 webhook routes to verify rawBody before enqueue
- Prisma client generated with cinetpay — next plan can use `prisma.payment` with new provider value
- No blockers — all verifications pass (`prisma validate`, `prisma generate`, `pnpm -r typecheck`, HMAC vectors)
- Remaining concern: ensure `apps/api/src/app.ts` registers rawBody capture (fastify-raw-body) in next webhook plan per RESEARCH Pitfall 1

---
*Phase: 03-payments*
*Completed: 2026-08-25*

## Self-Check: PASSED

- [x] `packages/db/prisma/schema.prisma` contains `cinetpay`
- [x] `packages/shared/src/money.ts` exports `calcCommission`
- [x] `apps/api/src/payments/providers/types.ts` exports `PaymentProvider`
- [x] `apps/api/src/payments/providers/notchpay.adapter.ts` contains `NotchPayAdapter`
- [x] `apps/api/src/payments/providers/cinetpay.adapter.ts` contains `CinetPayAdapter`
- [x] `apps/api/src/payments/webhooks/verify.ts` exports `verifyNotchSignature` and `verifyCinetToken`
- [x] `git log --oneline --grep="03-01"` shows 3 commits
- [x] `pnpm -r typecheck` passes 0 errors

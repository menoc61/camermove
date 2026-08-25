---
phase: 02-booking-core
plan: 03
gap_closure: true
subsystem: booking
tags: [expireHolds, setInterval, worker, trip-status, RBAC, prisma-migration, audit-log, vitest, postgres]

# Dependency graph
requires:
  - phase: 02-booking-core (plans 01-02)
    provides: expireHolds service + [status, holdExpiresAt] index, atomicHoldSeats repository, requireAuth plugin, Trip/Transporter/User models
provides:
  - Worker 60s expireHolds scheduling (BOOK-02 / SC2) with SIGTERM cleanup of both interval handles
  - Payment-safe expiry: findExpiredHolds excludes active pending/processing payments; FOR UPDATE row lock + status re-check inside tx prevents confirm/expiry races
  - POST /trips/:id/status — authenticated transporter-owned pause/close/reopen with server-side action whitelist (BOOK-05 / SC3)
  - User.transporterId nullable FK (migration 20260825110739_user_transporter_link) enabling ownership enforcement
  - POST /trips/bulk locked behind requireAuth + admin/super_admin branch with AuditLog
  - Committed regression suites: live-PG expire-holds integration test + permanent concurrent last-seat race test
affects: [phase-3-payments (late-payment confirmation safety), phase-4-worker (BullMQ upgrade path), phase-5-transporter-workspace (User.transporterId reuse)]

# Tech tracking
tech-stack:
  added: [] # zero new dependencies
  patterns: [worker globalThis interval-handle + SIGTERM clear, FOR UPDATE re-check inside $transaction, server-side action→status whitelist map, baseline-snapshot assertions for shared dev DB tests]

key-files:
  created:
    - apps/api/src/bookings/expire-holds.integration.test.ts
    - apps/api/src/search/trip-status.ts
    - apps/api/src/search/trip-status.test.ts
    - packages/db/prisma/migrations/20260825110739_user_transporter_link/migration.sql
  modified:
    - apps/worker/src/index.ts
    - apps/api/src/bookings/service.ts
    - apps/api/src/bookings/repository.ts
    - packages/db/prisma/schema.prisma
    - apps/api/src/search/routes.ts
    - apps/api/src/bookings/routes.ts

key-decisions:
  - "Payment-protection in findExpiredHolds (payments none pending/processing) closes Race A — a late payment success can still confirm; no paid-but-seatless outcome"
  - "FOR UPDATE + status re-check inside expireHolds tx closes Race B — cannot overwrite a concurrent confirm or double-release seats"
  - "Bulk stays admin-only by design; transporters get granular per-trip control via the new status endpoint"
  - "Integration tests snapshot a baseline of pre-existing expirable rows so count assertions are hermetic on the shared dev DB"

patterns-established:
  - "Baseline-snapshot testing: when asserting global sweep counts against a shared dev DB, snapshot pre-existing matches and assert delta"
  - "Trigger-aware teardown: trg_booking_status writes AuditLog on every Booking.status change, so tests deleting users must clear their AuditLog rows first"

requirements-completed: [BOOK-02, BOOK-05]

# Metrics
duration: 18min
completed: 2026-08-25
status: complete
---

# Phase 2 Plan 3: Gap Closure Summary

**Worker schedules expireHolds every 60s with payment-safe expiry races closed, transporter-owned pause/close/reopen endpoint ships behind auth with User.transporterId FK ownership enforcement, and trips bulk is admin-only**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-25T10:53:38Z
- **Completed:** 2026-08-25T11:11:21Z
- **Tasks:** 3
- **Files modified:** 10 (4 created, 6 modified)

## Accomplishments
- BOOK-02 unblocked: abandoned pre-payment holds self-expire and release seats within one worker tick; expiry can no longer race payment confirmation (both Race A query-level exclusion and Race B transactional lock+re-check implemented per hardened plan)
- BOOK-05 complete at API level: authenticated transporter-owned pause/close/reopen with horizontal-privilege enforcement (foreign staff, unlinked staff, travelers all 403), plus the previously unauthenticated `POST /trips/bulk` deactivate/delete primitive now requires an admin token
- SC1 concurrency evidence made permanent: committed live-PG test proves exactly-one-winner on a 1-seat trip (previously only an ephemeral verifier probe)

## Task Commits

Each task was committed atomically:

1. **Task 1: Schedule expireHolds in worker + live-PG regression tests + permanent concurrent race test** - `34f9755` (feat)
2. **Task 2: Authenticated transporter-owned pause/close/reopen endpoint + lock down POST /trips/bulk behind admin auth** - `0740c13` (feat)
3. **Task 3: Remove dead-code fallback block in bookings bulk-cancel tail** - `be2e7f6` (refactor)

## Files Created/Modified
- `apps/worker/src/index.ts` - second 60s interval dynamic-importing bookings service → expireHolds, error-isolated per tick; both handles cleared on SIGTERM; BullMQ repeatable-job upgrade documented
- `apps/api/src/bookings/repository.ts` - findExpiredHolds now excludes bookings with active pending/processing Payments (orphaned export resolved — it is the query source for expireHolds)
- `apps/api/src/bookings/service.ts` - expireHolds uses findExpiredHolds; tx locks Booking row FOR UPDATE and re-checks status before expiring; skipped rows not counted
- `apps/api/src/bookings/expire-holds.integration.test.ts` - live-PG regression: expired hold → expired + exactly its seats returned; future hold untouched; processing-payment hold protected; second sweep idempotent
- `packages/db/src/repositories/seat.repository.test.ts` - new "concurrent last-seat race" describe block (Promise.allSettled, 1 fulfilled / 1 rejected, final 0 available / 1 held) with dedicated fixture trip + teardown
- `packages/db/prisma/schema.prisma` - User.transporterId nullable FK + Transporter.staffUsers back-relation
- `packages/db/prisma/migrations/20260825110739_user_transporter_link/migration.sql` - ALTER TABLE User ADD COLUMN transporterId + FK ON DELETE SET NULL
- `apps/api/src/search/trip-status.ts` - TripStatusActionSchema (pause/close/reopen enum), TRIP_ACTION_TO_STATUS whitelist, setTripStatus with NotFound/Forbidden branches, best-effort AuditLog ({from, to, actorId, role})
- `apps/api/src/search/routes.ts` - POST /trips/:id/status (requireAuth, cuid params, meta logging slug trip.status); POST /trips/bulk behind requireAuth + admin/super_admin branch with metadata log + AuditLog
- `apps/api/src/bookings/routes.ts` - removed unused dynamic prisma binding and no-op fallback conditional from bulk-cancel traveler branch (AGENTS.md §3)

## Decisions Made
- Payment-protection placed in `findExpiredHolds` where-clause AND guarded release kept in tx body — single source for "what is expirable" while the lock+re-check guards transition atomicity
- Bulk remains an admin-only cross-owner primitive; transporters receive granular ownership-scoped control through `/trips/:id/status` (orchestrator-sanctioned option)
- Integration tests invoke `setTripStatus`/`expireHolds` at function level (matching plan wording "rejects with ForbiddenError") rather than booting Fastify — HTTP-layer auth wiring is proven structurally (requireAuth gates verified in route registration) and the plugin itself is covered elsewhere
- Migration generated via `prisma migrate dev` successfully — db-push fallback documented in the plan was not needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Hermetic count assertion via baseline snapshot**
- **Found during:** Task 1 (integration test authoring)
- **Issue:** Shared dev DB contained 6 stray expirable bookings (leftovers from prior ephemeral probes); plan's literal "assert returned count is exactly 1" would fail non-deterministically
- **Fix:** Snapshot `baselineExpirable` in beforeAll and assert `count === baselineExpirable + 1` — preserves the plan's intent (only fixture A expires, B/C don't) hermetically
- **Files modified:** apps/api/src/bookings/expire-holds.integration.test.ts
- **Verification:** suite green twice consecutively; idempotency case confirms stability across sweeps
- **Committed in:** 34f9755 (Task 1 commit)

**2. [Rule 1 - Bug] Idempotency assertion corrected to zero**
- **Found during:** Task 1 (first test run failed: expected 6, received 0)
- **Issue:** Second sweep legitimately returns 0 because the first sweep already expired all baseline rows too — my initial `toBe(baselineExpirable)` expectation misunderstood the sweep's global scope
- **Fix:** Assert second sweep returns 0, re-check A stays expired and seat accounting unchanged; split into its own focused `it("is idempotent…")` case
- **Files modified:** apps/api/src/bookings/expire-holds.integration.test.ts
- **Verification:** 2/2 integration cases pass
- **Committed in:** 34f9755 (Task 1 commit)

**3. [Rule 3 - Blocking] Trigger-aware teardown for user deletion**
- **Found during:** Task 1 (afterAll FK failure: `AuditLog_actorId_fkey`)
- **Issue:** Postgres trigger `trg_booking_status` inserts an AuditLog row (actorId = booking owner) on every Booking.status change; expireHolds transitions therefore FK-restrict deletion of the fixture user
- **Fix:** Delete AuditLog rows for the actor before deleting users in afterAll (pattern recorded for future DB-touching suites)
- **Files modified:** apps/api/src/bookings/expire-holds.integration.test.ts
- **Verification:** teardown clean, file passes; repeated runs leave no orphan rows
- **Committed in:** 34f9755 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking-environment, 1 bug-in-test-authoring)
**Impact on plan:** All fixes confined to the new test file; production code matches the hardened plan verbatim. No scope creep.

## Issues Encountered
- None beyond the deviations above. `prisma migrate dev` completed without hanging (fallback path unused).

## Verification Evidence (all 8 plan gates)

| Gate | Result |
| ---- | ------ |
| 1. `pnpm -r typecheck` | 10 projects, 0 errors |
| 2. `pnpm --filter @camermove/db test` | 5/5 pass (incl. concurrent last-seat race) |
| 3. `pnpm --filter @camermove/api test` | 5 files, 17/17 pass (incl. expire-holds 2/2 + trip-status matrix 8/8) |
| 4. Worker caller gate | expireHolds referenced inside 60 * 1000 interval, error-isolated |
| 5. Wiring gate | findExpiredHolds imported/called by bookings/service.ts |
| 6. Auth gate | requireAuth present in /trips/bulk registration neighborhood |
| 6b. Payment-protection gate | `payments: { none: { status in [pending, processing] } }` in findExpiredHolds; test asserts C stays pending_payment |
| 7. Migration gate | `prisma migrate status` → "Database schema is up to date!" |
| 8. Dead-code gate | no `void p` match; rg dead/TODO/FIXME scan clean on all changed files |

## User Setup Required

None - no external service configuration required.

## Known Stubs

None introduced. Pre-existing worker event stubs (`bookingCreated`, `paymentCompleted`) intentionally untouched per plan prohibitions (Phase 4 consumes them).

## Next Phase Readiness
- Both phase-2 verification gaps closed: BOOK-02 (hold expiry scheduled + regression-tested) and BOOK-05 (pause/close authenticated + ownership-scoped; bulk hardened)
- Re-run `/gsd-verify-phase 2` — expected score 8/8 truths
- Phase 3 (payments) benefits directly: late payment success webhooks can no longer hit an auto-expired booking
- Phase 5 (transporter workspace) inherits `User.transporterId` for identity linking and the action-whitelist pattern for lifecycle UI

---
*Phase: 02-booking-core*
*Completed: 2026-08-25*

## Self-Check: PASSED

- All 4 created files verified on disk
- All 3 task commits verified in git log (34f9755, 0740c13, be2e7f6)
- All 8 plan-level verification gates re-run and passing (typecheck 0 errors; db 5/5; api 17/17)

---
phase: 02-booking-core
verified: 2026-08-25T11:24:00Z
status: gaps_found
score: 6/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Hold expiry releases seats (BOOK-02 / Roadmap SC2)"
    status: failed
    reason: >
      expireHolds() is implemented in apps/api/src/bookings/service.ts (with supporting index
      @@index([status, holdExpiresAt])) but has ZERO callers: no cron, no BullMQ delayed job,
      no worker interval, no route invokes it. apps/worker/src/index.ts only runs Kafka consumers
      plus an hourly reconcileStalePayments() that queries Payment rows exclusively — bookings whose
      payment was never initiated are invisible to it. Net effect: a booking abandoned before payment
      holds its seats FOREVER (seatsAvailable stays decremented), contradicting BOOK-02 and Roadmap
      SC2 ("Hold expiry releases seats").
    artifacts:
      - path: apps/api/src/bookings/service.ts
        issue: "expireHolds() orphaned — defined line 79, never imported/called anywhere in repo"
      - path: apps/worker/src/index.ts
        issue: "No hold-expiry scheduling; hourly interval calls reconcileStalePayments() only (Payment-scoped)"
      - path: apps/api/src/payments/jobs/reconciliation.ts
        issue: "failPayment releases seats only for bookings that HAVE a Payment row receiving failure/expiry"
    missing:
      - "Schedule expireHolds(): worker setInterval/BullMQ repeatable job (e.g. every minute) or equivalent trigger"
      - "Test proving an expired pending_payment booking gets status=expired AND held seats returned to available"
  - truth: "Transporter can pause/close an offer (Roadmap SC3 / BOOK-05 clause 2)"
    status: failed
    reason: >
      No transporter-facing capability exists anywhere: no /transporter routes, no authenticated
      endpoint mutates Trip.status, no UI. Trip.status is a free String defaulting 'active';
      createBooking gates on it ('Trajet non disponible') so the READ-side gate exists, but there is
      no way for a transporter to set paused/closed. The only status-mutating primitive is the
      Phase-1 POST /trips/bulk bulkTripAction (activate/deactivate/delete) which has NO auth
      preHandler — unauthenticated callers can deactivate or DELETE arbitrary trips. Search defaults
      status:'active' so deactivation does hide offers, but the capability is neither
      transporter-scoped nor authenticated.
    artifacts:
      - path: apps/api/src/search/routes.ts
        issue: "POST /trips/bulk registered without requireAuth (Phase-1 scope, but it is the only pause/close primitive)"
      - path: packages/db/prisma/schema.prisma
        issue: "Trip.status String @default(\"active\") — no lifecycle states, no ownership-scoped mutation endpoint"
    missing:
      - "Authenticated endpoint (transporter-owned or admin) to pause/close and reopen a trip/offer"
      - "Ownership enforcement: transporter may only mutate own trips"
deferred: []
behavior_unverified_items: []
human_verification:
  - test: "Run web+API live; complete search -> trip detail -> book -> passenger form -> recap -> confirm; verify reference shown, countdown ticks from holdExpiresAt"
    expected: "Booking created (201), confirmation page shows CM-reference; countdown matches server holdExpiresAt; 409 path shows 'Plus de places' message when seats exhausted"
    why_human: "Requires running servers and visual/browser interaction; automated checks here did not boot servers"
  - test: "Double-submit the recap button (or replay POST /bookings with same Idempotency-Key) against running stack"
    expected: "Second request replays cached 201 body with same booking id/reference — no second booking row"
    why_human: "Redis-backed replay behavior needs a live server + Redis; grep proves wiring but not runtime replay"
---

# Phase 2: Booking Core — Verification Report

**Phase Goal:** Travelers can hold seats and complete passenger info without double-booking.
**Verified:** 2026-08-25T11:24:00Z
**Status:** gaps_found
**Re-verification:** No — initial full verification (prior 02-VERIFICATION.md was a thin "passed" checklist with no must_haves/gaps structure and unverifiable endpoint-sweep claims; superseded by this report)

## ⚠️ MVP Mode Format Discrepancy

ROADMAP sets `Mode: mvp` for this phase, but the phase goal ("Travelers can hold seats and complete passenger info without double-booking.") is **not** in User Story form — `gsd-tools query user-story.validate` returns `valid=false`. Per the verifier contract, MVP User-Flow-Coverage narrowing was NOT applied (it would be low-quality against a non-story goal). Full goal-backward verification against the three ROADMAP Success Criteria was performed instead — this is the stricter contract. If the team wants MVP-mode semantics for this phase, run `/gsd mvp-phase 2` and re-verify.

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | BOOK-01: atomic seat hold, no double-booking | ✓ VERIFIED | `packages/db/src/repositories/seat.repository.ts` `atomicHoldSeats`: `$queryRaw SELECT … FOR UPDATE` inside `prisma.$transaction`, rejects when `seatsAvailable < count`. Verifier ran a one-shot concurrent probe (2 × `atomicHoldSeats(1)` via `Promise.allSettled` on a 1-seat trip, live Postgres): exactly 1 fulfilled, 1 rejected ConflictError, final state 0 available / 1 held. Repo suites: db 4/4, api 7/7 pass |
| 2  | BOOK-02: hold expiry releases seats | ✗ FAILED | Mechanism exists (`expireHolds()` service.ts:79, index `[status, holdExpiresAt]`) but **zero callers** repo-wide (worker/cron/queue/route). Hourly reconciliation is Payment-scoped only → abandoned pre-payment bookings hold seats indefinitely. See Gap 1 |
| 3  | BOOK-03: totalAmount = price × seatCount | ✓ VERIFIED | `service.ts:38` `totalAmount = trip.price * input.seatCount`, persisted on Booking, echoed in 201 response `{ booking, totalAmount, holdExpiresAt }` (routes.ts:19) |
| 4  | BOOK-04: unique reference | ✓ VERIFIED | `generateReference()` → `CM-XXXXXXXX`; schema enforces `reference String @unique` (schema.prisma:210); format matches `/^CM-[A-Z0-9]{6,}$/` (unit test passes) |
| 5  | BOOK-05a: cancel per policy works | ✓ VERIFIED | `cancellation.ts` tiered engine (time tiers >24h/12–24h/1–12h/<1h/departed, hold-cancel, used-ticket block, transporter-cancel, admin-force, AppSettings-configurable tiers); wired routes → `cancelBooking(id, actorId, role)` → `evaluateCancellation`; seat release (`pending_payment` → `atomicReleaseHeldSeats`, confirmed → booked decrement), ticket voiding, refund marking, AuditLog |
| 6  | BOOK-05b / Roadmap SC3: transporter can pause/close an offer | ✗ FAILED | No authenticated trip-status mutation anywhere; no transporter surface. Only primitive is unauthenticated `POST /trips/bulk` (Phase-1) with activate/deactivate/delete. See Gap 2 |
| 7  | Idempotency-Key replay on booking create | ✓ VERIFIED | Global `idempotencyPlugin` (app.ts:31) intercepts POST/PUT/PATCH with header; Redis `setex` 24h keyed `idemp:{url}:{key}` with memory fallback; replay returns cached status+body pre-handler (no re-execution). Frontend sends `Idempotency-Key: crypto.randomUUID()` (lib/api/bookings.ts:8,25,32) |
| 8  | Metadata ip/os/browser collected on booking create | ✓ VERIFIED | `metadataPlugin` sets `req.meta {ip, os, browser, device, ua, referer, requestId}` globally; route logs `{...meta, tripId, seatCount, passengerCount, userId}, "booking.create"` (routes.ts:17); service persists AuditLog with tripId/seatCount/passengerCount/totalAmount/reference |

**Score:** 6/8 truths verified (0 present-behavior-unverified)

### Deferred Items

None. Both gaps were checked against later milestone phases (Step 9b):

- *Pause/close* — Phase 5 SC1 lists profile/vehicles/routes/schedules/prices/capacity but never states pause/close; matching is not explicit enough to defer conservatively. **Note:** Phase 5 is the natural home if the developer chooses to move SC3 there — that requires a ROADMAP edit or override, decided by the human, not silently by the verifier.
- *Hold-expiry scheduling* — Phase 3 covers payment-failure/expiry-driven release only; no later phase schedules booking-hold expiry. Real gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `apps/api/src/bookings/repository.ts` | find/create helpers | ✓ VERIFIED | 33 lines, substantive; note `findExpiredHolds()` also orphaned |
| `apps/api/src/bookings/service.ts` | createBooking/expireHolds/cancel/confirm | ✓ VERIFIED (wiring gap inside) | Atomic hold + compensating release, AppSettings holdExpiryMinutes, Kafka `booking.created` best-effort, AuditLog; `expireHolds` uncalled |
| `apps/api/src/bookings/schema.ts` | Zod CreateBookingBody | ✓ VERIFIED | tripId cuid, seatCount bounds, passengers fullName+phone |
| `apps/api/src/bookings/cancellation.ts` | tiered policy engine | ✓ VERIFIED | 125 lines, DB-configurable tiers with fallback |
| `apps/api/src/bookings/routes.ts` | POST/GET/cancel/bulk/export | ✓ VERIFIED | RBAC owner/admin guard on GET, metadata logging, export CSV/JSON; minor dead code (see anti-patterns) |
| `apps/web/app/book/[tripId]/page.tsx` | booking page | ✓ VERIFIED | fetches trip price, clamps seatCount 1..10 preserving passengers, renders both components |
| `apps/web/components/booking/passenger-form.tsx` | E.164 validation | ✓ VERIFIED | inline errors, optional-phone E.164 rule |
| `apps/web/components/booking/recap.tsx` | breakdown + countdown + errors | ✓ VERIFIED | MM:SS countdown off `holdExpiresAt`, 409/429 specific messages, disabled submit on invalid |
| `apps/web/lib/api/bookings.ts` | typed API client | ✓ VERIFIED | create/get/cancel/bulkCancel, Bearer + Idempotency-Key headers |
| Transporter pause/close surface (endpoint/UI) | SC3 | ✗ MISSING | Does not exist anywhere in repo |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `routes.ts` POST /bookings | `service.createBooking` | import + call | ✓ WIRED | 201 response echoes totalAmount/holdExpiresAt |
| `service.createBooking` | `db.atomicHoldSeats` | FOR UPDATE transaction | ✓ WIRED | + compensating `atomicReleaseHeldSeats` on failure path |
| `service.cancelBooking` | `cancellation.evaluateCancellation` | dynamic import | ✓ WIRED | tier result drives seat/refund/status transitions |
| `service.createBooking` | Kafka `booking.created` + AuditLog | publishBookingCreated | ✓ WIRED | best-effort, non-blocking; topic exists in packages/events |
| web `recap.tsx` | `POST /api/v1/bookings` | fetch via lib/api/bookings | ✓ WIRED | Bearer + Idempotency-Key; 409/429 handled |
| web `page.tsx` | PassengerForm + Recap | JSX composition | ✓ WIRED | Zustand store shared state |
| `app.ts` | bookings/payment/auth/search routes + plugins | register | ✓ WIRED | idempotency + metadata global |
| **scheduler/worker** | **`service.expireHolds`** | cron/queue/route | ✗ **NOT_WIRED** | Zero callers repo-wide — Gap 1 |
| **transporter identity** | **Trip.status pause/close mutation** | owned endpoint | ✗ **NOT_WIRED** | No such endpoint — Gap 2 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `recap.tsx` | `price` prop | `GET /api/v1/trips/:id` → Prisma findUnique | Yes (live query) | ✓ FLOWING |
| `recap.tsx` | `total` | price × seatCount (user Zustand input) | Yes | ✓ FLOWING |
| `passenger-form.tsx` | `passengers` | Zustand `useBookingStore` (packages/frontend) | Yes | ✓ FLOWING |
| `page.tsx` | `trip.price` | fetch with loading fallback | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Typecheck all workspaces | `pnpm -r typecheck` | 10 projects, 0 errors | ✓ PASS |
| Booking unit tests | `pnpm --filter @camermove/api test` | 3 files, 7/7 passed | ✓ PASS |
| Seat-lock integration tests (live PG) | `pnpm --filter @camermove/db test` | 1 file, 4/4 passed | ✓ PASS |
| **Concurrent last-seat race (verifier probe)** | temp vitest: 2 × `atomicHoldSeats(1)` via `Promise.allSettled`, 1-seat trip, live Postgres | exactly 1 fulfilled / 1 rejected; final 0 available / 1 held | ✓ PASS |
| `expireHolds` reachable at runtime | repo-wide rg for callers | definition + comments only, 0 callers | ✗ FAIL |
| Trip-status pause/close endpoint | rg across all route files | none exists | ✗ FAIL |

Probe note: the concurrent probe was a temporary self-cleaning test file (created, executed, deleted). The committed repo contains only the **sequential** insufficiency test — the roadmap wording "(concurrent-last-seat tests pass)" is currently satisfied by evidence gathered during verification, not by a persistent regression test. Recommend committing a permanent version of the probe test.

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| scripts/*/tests/probe-*.sh | discovery | none exist in repo | N/A (none declared; SUMMARY notes `pnpm smoke:booking` deliberately deferred by plan) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| BOOK-01 | 02-PLAN | Create booking w/ passengers + atomic hold, no double-booking | ✓ SATISFIED | Truth 1 (probe-proven) |
| BOOK-02 | 02-PLAN | Hold expires and releases seats | ✗ BLOCKED | Truth 2 — expiry never triggered automatically |
| BOOK-03 | 02-PLAN | totalAmount computed correctly | ✓ SATISFIED | Truth 3 |
| BOOK-04 | 02-PLAN | Unique reference | ✓ SATISFIED | Truth 4 (@unique + generator) |
| BOOK-05 | 02-PLAN | Cancel per policy; transporter pause/close | ⚠️ PARTIAL | Cancel half SATISFIED (Truth 5); pause/close half BLOCKED (Truth 6) |

Orphaned requirements: none — REQUIREMENTS.md maps exactly BOOK-01..05 to Phase 2; all claimed by 02-PLAN.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| apps/api/src/bookings/routes.ts | 67–75 | Dead code: unused `prisma` destructures + `void p` no-op fallback block | ⚠️ Warning | AGENTS.md §3 no-dead-code; confusing bulk-cancel handler tail |
| apps/api/src/bookings/service.test.ts | 11–22 | Tautological tests (asserts `price*seatCount` arithmetic and Date math, not service code) | ℹ️ Info | Weak evidence; real coverage lives in db package + probe |
| apps/api/src/bookings/service.test.ts | 26 | Comment claims integration covered elsewhere — concurrency was NOT covered by any committed test until verifier probe | ℹ️ Info | Commit a permanent concurrent test |
| apps/worker/src/index.ts | 15–16 | Empty stub handlers (`bookingCreated`, `paymentCompleted` → `async () => {}`) | ℹ️ Info | Phase 4 will consume; acceptable interim, tracked by roadmap |
| apps/api/src/search/routes.ts | 17 | `POST /trips/bulk` without auth (Phase-1 scope; intersects SC3 as the only deactivate primitive) | ⚠️ Warning | Unauthenticated trip delete/deactivate possible — flag to secure-phase/Phase 5 |

Debt markers (TBD/FIXME/XXX/HACK/PLACEHOLDER): none in phase files (only false positives: E.164 example string, HTML placeholders, intentional `.catch(() => {})`).

### Human Verification Required

1. **End-to-end booking flow (browser)** — run `docker compose up -d` + API + web; search → detail → book → passengers → recap → confirm.
   - Expected: 201 booking, CM-reference confirmation, countdown ticking from server `holdExpiresAt`, correct XAF totals.
   - Why human: requires live servers + visual interaction; this verification did not boot application servers.
2. **Idempotency replay through live Redis** — double-click submit / replay POST with same `Idempotency-Key`.
   - Expected: identical replayed 201 body, single booking row.
   - Why human: plugin wiring is grep-verified; runtime Redis replay is behavioral.

### Gaps Summary

The core promise of Phase 2 — **race-safe atomic seat holding** — is genuinely achieved: `SELECT … FOR UPDATE` row locks in a transaction, proven by the verifier's concurrent probe (exactly-one-winner on the last seat) plus passing integration suites, with compensating release, unique references, correct totals, tiered cancellation, idempotency, and metadata logging all present and wired. The frontend slice is substantive and connected.

Two roadmap-contract items fail:

1. **Hold expiry is dead code** (BOOK-02 / SC2): `expireHolds()` and its supporting index exist, but nothing in any process ever calls it. The payments-side reconciliation only rescues bookings that have Payment rows. A traveler who abandons checkout before initiating payment permanently removes those seats from sale — precisely the availability leak the phase exists to prevent. Fix is small: schedule the existing function in the worker (interval or BullMQ repeatable) and add a regression test asserting expired holds return seats.
2. **Transporter pause/close does not exist** (SC3 / BOOK-05 clause 2): no endpoint, no ownership scoping, no UI. Worse, the sole status-mutating primitive (`POST /trips/bulk`) is unauthenticated. Either implement minimal transporter/admin-scoped pause-close in this phase's remediation, or consciously move SC3 to Phase 5 via roadmap update + override.

The prior 02-VERIFICATION.md "passed" verdict relied on claims that could not be reproduced from the repo (e.g., "concurrent holds prepared", endpoint sweeps) and missed both gaps above; it is superseded by this report.

---

_Verified: 2026-08-25T11:24:00Z_
_Verifier: the agent (gsd-verifier)_

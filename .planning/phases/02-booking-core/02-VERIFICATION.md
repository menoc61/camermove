---
phase: 02-booking-core
verified: 2026-08-25T11:18:30Z
status: human_needed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/8
  gaps_closed:
    - "Hold expiry releases seats (BOOK-02 / Roadmap SC2) — expireHolds scheduled in worker on a 60s interval with payment-safe expiry and FOR UPDATE re-check; live-PG regression test proves expired hold → status=expired + seats returned, future hold untouched, processing-payment hold protected"
    - "Transporter can pause/close an offer (Roadmap SC3 / BOOK-05 clause 2) — POST /trips/:id/status behind requireAuth with User.transporterId ownership enforcement and server-side action whitelist; POST /trips/bulk locked behind requireAuth + admin/super_admin branch; full live-PG authorization matrix passes 8/8"
  gaps_remaining: []
  regressions: []
deferred: []
behavior_unverified_items: []
human_verification:
  - test: "Run web+API live; complete search -> trip detail -> book -> passenger form -> recap -> confirm; verify reference shown, countdown ticks from holdExpiresAt"
    expected: "Booking created (201), confirmation page shows CM-reference; countdown matches server holdExpiresAt; 409 path shows 'Plus de places' message when seats exhausted"
    why_human: "Requires running servers and visual/browser interaction; automated checks here did not boot application servers or a browser"
  - test: "Double-submit the recap button (or replay POST /bookings with same Idempotency-Key) against running stack"
    expected: "Second request replays cached 201 body with same booking id/reference — no second booking row"
    why_human: "Redis-backed replay behavior needs a live server + Redis; grep proves wiring but not runtime replay"
  - test: "Against the running API: curl POST /trips/bulk without Authorization header, then with a traveler JWT"
    expected: "No header → 401 at requireAuth preHandler; traveler token → 403 'Accès refusé'; admin token → 200"
    why_human: "HTTP-layer preHandler rejection is proven structurally (requireAuth wired in registration) and by function-level tests, but the 401/403 status-code mapping over real HTTP needs a booted server"
---

# Phase 2: Booking Core — Verification Report

**Phase Goal:** Travelers can hold seats and complete passenger info without double-booking.
**Verified:** 2026-08-25T11:18:30Z
**Status:** human_needed — all 8 truths verified (both prior gaps closed with behavioral evidence); 3 standing human/UAT items remain open from initial verification
**Re-verification:** Yes — after gap closure execution (02-03-PLAN; commits 34f9755, 0740c13, be2e7f6)

## ⚠️ MVP Mode Format Discrepancy

ROADMAP sets `Mode: mvp` for this phase, but the phase goal ("Travelers can hold seats and complete passenger info without double-booking.") is **not** in User Story form — `gsd-tools query user-story.validate` returns `valid=false`. Per the verifier contract, MVP User-Flow-Coverage narrowing was NOT applied (it would be low-quality against a non-story goal). Full goal-backward verification against the three ROADMAP Success Criteria was performed instead — this is the stricter contract. If the team wants MVP-mode semantics for this phase, run `/gsd mvp-phase 2` and re-verify.

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | BOOK-01: atomic seat hold, no double-booking | ✓ VERIFIED | `packages/db/src/repositories/seat.repository.ts` `atomicHoldSeats`: `$queryRaw SELECT … FOR UPDATE` inside `prisma.$transaction`, rejects when `seatsAvailable < count`. **Concurrency evidence now permanent**: committed "concurrent last-seat race" describe block (`seat.repository.test.ts:74–98`) fires `Promise.allSettled` of two holds on a fresh 1-seat trip and asserts exactly 1 fulfilled / 1 rejected / final 0 available / 1 held. Suite ran green this re-verification: db **5/5** |
| 2  | BOOK-02: hold expiry releases seats | ✓ VERIFIED _(gap closed)_ | **Caller exists**: `apps/worker/src/index.ts:39–46` — `setInterval(…, 60 * 1000)` dynamic-imports bookings service, calls `expireHolds()`, error-isolated per tick, logs released count; handle stored on `globalThis.__expireHoldsInterval` and cleared in SIGTERM (lines 58–61). **Payment-safe query**: `repository.ts findExpiredHolds()` excludes bookings with active pending/processing Payments (`payments: { none: { status: { in: ["pending","processing"] } } }`). **Race B closed**: `service.ts expireHolds()` locks the row `FOR UPDATE` inside the tx and skips if status is no longer `pending_payment`. **Behavioral proof**: committed live-PG regression `expire-holds.integration.test.ts` — expired hold A → `expired` + exactly its 2 seats returned (available 2 / held 2); future hold B untouched; processing-payment hold C protected; second sweep idempotent. Ran green: api **17/17** |
| 3  | BOOK-03: totalAmount = price × seatCount | ✓ VERIFIED | `service.ts:39` `totalAmount = trip.price * input.seatCount`, persisted on Booking, echoed in 201 response `{ booking, totalAmount, holdExpiresAt }`; unchanged since initial verification, typecheck clean |
| 4  | BOOK-04: unique reference | ✓ VERIFIED | `generateReference()` → `CM-XXXXXXXX`; schema enforces `reference String @unique` (schema.prisma:213, re-checked this run) |
| 5  | BOOK-05a: cancel per policy works | ✓ VERIFIED | Tiered engine unchanged (`cancellation.ts`); api suite green incl. cancellation cases |
| 6  | BOOK-05b / Roadmap SC3: transporter can pause/close an offer | ✓ VERIFIED _(gap closed)_ | **Endpoint**: `POST /trips/:id/status` (routes.ts:46–53) with `preHandler: app.requireAuth()`, cuid param validation, meta logging slug `trip.status`. **Logic**: `trip-status.ts` `setTripStatus` — transporter_staff ownership check `user.transporterId !== trip.transportId` → ForbiddenError; unlinked staff and non-admin/traveler roles → ForbiddenError; admin/super_admin any trip; status set ONLY via server-side whitelist map `TRIP_ACTION_TO_STATUS {pause→paused, close→closed, reopen→active}`; best-effort AuditLog `{from,to,actorId,role}`. **Identity link**: `User.transporterId String?` FK (schema.prisma:93,100, onDelete SetNull) + migration `20260825110739_user_transporter_link`; `prisma migrate status` → "Database schema is up to date!". **Hardened bulk**: `POST /trips/bulk` now `requireAuth` preHandler + in-handler admin/super_admin branch (routes.ts:23–43) with metadata log + AuditLog. **Behavioral proof**: live-PG authorization matrix `trip-status.test.ts` — own pause/reopen/close, foreign staff forbidden (status unchanged), unlinked staff forbidden, traveler forbidden, admin transitions ANY trip, unknown trip NotFound. Ran green: 8/8 |
| 7  | Idempotency-Key replay on booking create | ✓ VERIFIED | Global `idempotencyPlugin` registered (app.ts:31, re-checked); Redis `setex` 24h keyed replay returns cached status+body pre-handler; frontend sends header. Runtime replay remains in human verification below |
| 8  | Metadata ip/os/browser collected on booking create | ✓ VERIFIED | `metadataPlugin` registered globally (app.ts:29, re-checked); route logs `{...meta, tripId, seatCount, passengerCount, userId}, "booking.create"`; service persists AuditLog |

**Score:** 8/8 truths verified (0 present-behavior-unverified)

### Gap-Closure Regression Checks (prior 6 passing truths)

Quick existence + sanity re-check per re-verification protocol — none regressed: seat primitives untouched (db suite green), totalAmount line intact, `@unique` present, cancellation engine untouched, both plugins still registered globally, working tree clean at HEAD `420885d` (what was tested == what is committed).

### Deferred Items

None. Re-checked Step 9b after closure: no remaining failed truth exists to defer.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `apps/worker/src/index.ts` | expireHolds scheduling interval + SIGTERM clear | ✓ VERIFIED | Lines 37–46: 60s cadence, error-isolated `.catch`, count log; both handles cleared lines 58–61; BullMQ upgrade documented in comment |
| `apps/api/src/bookings/repository.ts` | findExpiredHolds payment-safe query source | ✓ VERIFIED | `payments: { none: { status in [pending, processing] } }` — orphaned export resolved (now called by service.ts:83) |
| `apps/api/src/bookings/service.ts` | expireHolds with lock + re-check | ✓ VERIFIED | `$queryRaw … FOR UPDATE` then `findUnique`; skip when row gone or status ≠ `pending_payment`; skipped rows not counted; guarded release retained |
| `apps/api/src/bookings/expire-holds.integration.test.ts` | Live-PG expiry regression | ✓ VERIFIED | 155 lines; fixtures A/B/C; asserts count delta over baseline snapshot, statuses, exact seat accounting (2 available / 2 held), idempotent second sweep |
| `packages/db/src/repositories/seat.repository.test.ts` | Permanent concurrent race case | ✓ VERIFIED | Dedicated describe block, fresh 1-seat race trip inside the test, allSettled exactly-one-winner assertions, teardown extended |
| `packages/db/prisma/schema.prisma` | User.transporterId nullable FK | ✓ VERIFIED | Line 93/100 + Transporter back-relation; migration folder present; migrate status up-to-date |
| `apps/api/src/search/trip-status.ts` | Action schema + ownership-enforced setTripStatus | ✓ VERIFIED | 52 lines (<80 budget); enum-only input; whitelist map; NotFound/Forbidden branches; AuditLog best-effort |
| `apps/api/src/search/routes.ts` | Authed status endpoint + admin-only bulk | ✓ VERIFIED | `/trips/:id/status` requireAuth + cuid + meta log; `/trips/bulk` requireAuth preHandler + admin branch + metadata/AuditLog |
| `apps/api/src/search/trip-status.test.ts` | Authorization matrix | ✓ VERIFIED | 8 live-PG cases covering the full denial matrix incl. status-unchanged assertion on foreign-staff rejection |
| `apps/api/src/bookings/routes.ts` | Dead-code-free bulk-cancel tail | ✓ VERIFIED | `void p` gate clean; GET detail/export dynamic imports intact (api suite green) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `routes.ts` POST /bookings | `service.createBooking` | import + call | ✓ WIRED | Unchanged; 201 echoes totalAmount/holdExpiresAt |
| `service.createBooking` | `db.atomicHoldSeats` | FOR UPDATE transaction | ✓ WIRED | Compensating release on failure path |
| `apps/worker/src/index.ts` | `service.expireHolds` | setInterval dynamic import every 60_000ms | ✓ WIRED _(was NOT_WIRED — Gap 1 closed)_ | Error-isolated per tick; SIGTERM clears both handles |
| `service.expireHolds` | `repository.findExpiredHolds` | imported call (payment-safe where clause) | ✓ WIRED | Orphaned export resolved |
| `routes.ts` POST /trips/:id/status | `trip-status.setTripStatus` | requireAuth preHandler + call | ✓ WIRED | cuid params, action schema, meta logging |
| `setTripStatus` transporter branch | `User.transporterId === trip.transportId` | ownership check | ✓ WIRED | Migration applied; mismatch/unlinked → ForbiddenError (test-proven) |
| `routes.ts` POST /trips/bulk | requireAuth + admin branch | preHandler + role guard | ✓ WIRED _(was unauthenticated — Gap 2 closed)_ | Only remaining Trip.status writers are these two authed paths |
| web `recap.tsx` → `POST /bookings`; web page composition; app plugin registration | — | — | ✓ WIRED | Unchanged from initial verification |

### Data-Flow Trace (Level 4)

Unchanged from initial verification — frontend slice untouched by gap closure: `recap.tsx` price (live Prisma fetch), total (price × user seatCount), `passenger-form.tsx` passengers (Zustand store), `page.tsx` trip.price — all ✓ FLOWING.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Typecheck all workspaces | `pnpm -r typecheck` | 10 projects, exit 0 | ✓ PASS |
| Seat primitives + permanent concurrent race (live PG) | `pnpm --filter @camermove/db test` | 1 file, **5/5 passed** (4 sequential + race) | ✓ PASS |
| Full API suite incl. expiry regression + authz matrix (live PG) | `pnpm --filter @camermove/api test` | 5 files, **17/17 passed** | ✓ PASS |
| Test enumeration (existence proof, no suite rerun) | `vitest list` | expire-holds 2 cases + trip-status 8 cases enumerated | ✓ PASS |
| Worker caller gate | read `apps/worker/src/index.ts` | `expireHolds` inside `60 * 1000` interval, error-isolated | ✓ PASS |
| Payment-protection gate | read `repository.ts` + integration test C fixture | `payments: none` clause; C stays `pending_payment` asserted | ✓ PASS |
| Auth gate | read `search/routes.ts` | requireAuth directly in both registrations; admin branch in bulk handler | ✓ PASS |
| Migration gate | `prisma migrate status` | "Database schema is up to date!" (4 migrations) | ✓ PASS |
| Dead-code gate | `rg "void\s+p\b"` bookings/routes.ts | no match | ✓ PASS |
| Debt markers | TBD/FIXME/XXX/HACK/PLACEHOLDER across 9 changed files | none | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| scripts/*/tests/probe-*.sh | discovery | none exist in repo | N/A (none declared) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| BOOK-01 | 02-PLAN | Atomic hold, no double-booking | ✓ SATISFIED | Truth 1 (permanent race test green) |
| BOOK-02 | 02-PLAN / gap plan 03 | Hold expires and releases seats | ✓ SATISFIED _(was BLOCKED)_ | Truth 2 — scheduled, payment-safe, regression-tested |
| BOOK-03 | 02-PLAN | totalAmount computed correctly | ✓ SATISFIED | Truth 3 |
| BOOK-04 | 02-PLAN | Unique reference | ✓ SATISFIED | Truth 4 |
| BOOK-05 | 02-PLAN / gap plan 03 | Cancel per policy; transporter pause/close | ✓ SATISFIED _(was PARTIAL)_ | Truths 5 + 6 — pause/close authenticated & ownership-scoped; bulk admin-only |

Orphaned requirements: none.

### Prohibition Dispositions (gap plan must_haves.prohibitions — judgment tier, LLM-judge verdicts)

All five prohibitions reduce to statically inspectable facts; each verified by direct code inspection this run (non-authoritative LLM-judge verdicts — flag for human review during UAT):

1. expireHolds always has ≥1 non-test caller → worker interval is the only production caller — satisfied
2. No unauthenticated route mutates Trip.status or deletes trips → repo-wide sweep finds exactly two status writers (`trip-status.ts:37`, `advanced.ts:147` via routes), both behind `requireAuth` — satisfied
3. Client input never sets arbitrary Trip.status → both writers map server-side enums to statuses; request bodies carry actions only — satisfied
4. No UI surface for pause/close → `rg -i "pause|close|:id/status"` across apps/web: clean — satisfied
5. Tautological unit cases + empty worker event stubs left untouched → stubs still empty at worker:15–16 (Phase 4 scope); service.test.ts unchanged — satisfied

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| apps/api/src/bookings/service.test.ts | 11–22 | Tautological tests (arithmetic, not service code) | ℹ️ Info | Carried from initial verification; intentionally untouched per plan prohibition; tracked separately |
| apps/worker/src/index.ts | 15–16 | Empty stub handlers (`bookingCreated`, `paymentCompleted`) | ℹ️ Info | Phase 4 consumes them; explicitly out of gap-closure scope |

Resolved this cycle: dead-code fallback block in bookings/routes.ts (removed in be2e7f6); unauthenticated `POST /trips/bulk` (locked down in 0740c13). Debt markers: none in changed files.

### Human Verification Required

Carried forward from initial verification (unchanged scope — neither item was addressable by gap closure) plus one new HTTP-layer check:

1. **End-to-end booking flow (browser)** — run `docker compose up -d` + API + web; search → detail → book → passengers → recap → confirm.
   - Expected: 201 booking, CM-reference confirmation, countdown ticking from server `holdExpiresAt`, correct XAF totals.
   - Why human: requires live servers + visual interaction; automated verification does not boot application servers.
2. **Idempotency replay through live Redis** — double-click submit / replay POST with same `Idempotency-Key`.
   - Expected: identical replayed 201 body, single booking row.
   - Why human: plugin wiring is grep-verified; runtime Redis replay is behavioral.
3. **Bulk route HTTP auth codes (new)** — `curl -X POST …/api/v1/trips/bulk` with no token, then a traveler token, then an admin token.
   - Expected: 401 / 403 / 200 respectively.
   - Why human: function-level tests prove the logic; real-HTTP status mapping through Fastify needs a booted server.

### Gaps Summary

Both verification gaps are closed with behavioral evidence, not just presence:

1. **BOOK-02 (hold expiry)** — `expireHolds()` now has a production caller: the worker schedules it every 60 seconds with per-tick error isolation and clean SIGTERM handling. The expiry itself is hardened beyond the original gap: `findExpiredHolds()` refuses to select bookings carrying an active pending/processing Payment (a late success webhook can still confirm — no paid-but-seatless outcome), and the transaction locks the booking row `FOR UPDATE` and re-checks status before transitioning, closing the confirm/expiry race. The committed live-PG regression proves the full contract: expired hold → `expired` + exactly its seats returned, future hold untouched, payment-shielded hold protected, second sweep a no-op.
2. **SC3 / BOOK-05 clause 2 (pause/close)** — a real capability now exists: `POST /trips/:id/status` behind authentication, with transporter ownership enforced through the new `User.transporterId` FK (migration applied, DB up-to-date), admins empowered for any trip, statuses reachable only via a server-side action whitelist, and AuditLog rows on every transition. The previously wide-open `POST /trips/bulk` deactivate/delete primitive now demands an admin token. The eight-case live-PG authorization matrix — including the foreign-staff-rejected-with-status-unchanged assertion — passes green.

Zero regressions detected across the six previously verified truths; typecheck 10/10 projects clean; db suite 5/5 and api suite 17/17 against live Postgres; working tree clean at HEAD so tested state equals committed state.

**Why status is `human_needed` rather than `passed`:** all 8 observable truths are verified and no structural gaps remain, but the decision tree reserves `passed` for a fully empty human-verification section. Three items remain open — the two standing live-stack/browser checks from the initial report plus the new HTTP-layer 401/403 check on the hardened bulk route. Run `/gsd-verify-work` (UAT conversation) against a booted stack to discharge them.

---

_Verified: 2026-08-25T11:18:30Z_
_Verifier: the agent (gsd-verifier)_

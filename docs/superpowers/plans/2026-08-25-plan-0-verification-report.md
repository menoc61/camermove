# Plan 0 — Verification Gate Report (Phases 1–4)

**Date:** 2026-08-25
**Branch:** `verify/plan-0-gate`
**HEAD at gate time:** `dad1ee9f2f3c5f8dc1e7c281c211de0d39c74908` (`dad1ee9` — test(smoke): make tickets suite self-contained)
This report is committed as one docs-only commit on top of that SHA; no code changed after the gate run.

## Verdict

**All gates PASS.** Phases 1–4 verified end-to-end: typecheck 0 errors across 10 packages, 39/39 unit tests, DB schema up to date, auth+search / tickets / dashboard smoke suites green against the live stack, all three web pages render 200, and the full HTTP booking chain (register → login → search → booking with Idempotency-Key → confirm → ticket lookup) verified live.

## Final combined gate (run in order, this task)

| # | Command | Exit code | Evidence |
|---|---------|-----------|----------|
| 1 | `pnpm -r typecheck` | **0** | All 10 packages `tsc --noEmit` Done, zero errors |
| 2 | `pnpm -r test` | **0** | 39 tests passed, 0 failed (shared 6, frontend 2, config 2, events 1, media 2, db 5, observability 2, api 19; web/worker `--passWithNoTests`) |
| 3 | `pnpm smoke` | **0** | auth: register/login/me ✓ · search: Yaoundé→Douala 6 items + trip detail ✓ |
| 4 | `pnpm smoke:tickets` | **0** | TICK-01 confirmed+1 ticket+QR PNG+12-char code ✓ · TICK-02 sanitized lookup, no PII ✓ · replay idempotent (1 ticket, 1 commission) ✓ · fan-out 9 rows / 3 event types ✓ · trip-reminder exactly 1 event, 1 row per channel ✓ |
| 5 | `pnpm smoke:dashboard` (`WEB_URL=http://localhost:3002`) | **0** | dashboard keys {upcoming,history,tickets} ✓ · unauth 401 ✓ · non-owner ticket 404 (no leak) ✓ · SSR 200 shows ref CM-77090348 without verificationCode ✓ · unknown well-formed ref → "Billet introuvable" ✓ |

Services during gate: API healthy on :3000 (`{"status":"ok"}`), worker subscribed to its 8 handler topics (detached, logs `.superpowers/sdd/plan-0/{api,worker}.log`), web dev server on :3002. No restarts were needed.

## Per-gate evidence table (plan history)

| Gate | Result | One-line evidence |
|------|--------|-------------------|
| Typecheck | **PASS** | Task 2: exit 0 across 10 packages, lockfile untouched; re-confirmed exit 0 at final gate above |
| Unit tests (incl. contracts) | **PASS** | Task 3: 39/39 incl. `concurrent last-seat race > allows exactly one winner…` (packages/db/src/repositories/seat.repository.test.ts:74-97) and `idempotencyPlugin replay > replays the same status+body without re-executing the handler` (apps/api/src/plugins/idempotency.test.ts) |
| Migrate status | **PASS** | Task 4: "5 migrations found … Database schema is up to date!"; seed present (User=18, Trip=11) |
| Smoke auth+search | **PASS** | Task 6: register/login/me + search(6)/trip-detail, 5/5 assertions, exit 0; re-run green at final gate |
| Tickets suite | **PASS** | Task 6: TICK-01/02, idempotency replay, NOTIF fan-out (email+whatsapp+push), trip-reminder dedupe (exactly 1 event); re-run green at final gate |
| Dashboard suite | **PASS** | Task 6: login/dashboard shape, 401 unauth, 404 non-owner, SSR contains ref & not verificationCode, not-found branch renders "Billet introuvable"; re-run green at final gate |
| Web pages | **PASS** | Task 7: home `/`, `/results?origin=Yaoundé&destination=Douala…`, `/tickets/lookup` all HTTP 200 on :3002 (clean boot, Ready in 528ms; re-checked after chain run) |
| HTTP booking chain | **PASS** | Task 7: TASK7_CHAIN_GREEN — register 201 → login 200 → search 200 (6 trips) → POST /bookings 201 (ref CM-FBCCD080, Bearer + Idempotency-Key) → confirmPaymentSuccess → status confirmed → public lookup 200 valid + owner GET /me/tickets/:id 200 with 12-char code |

## Fixes made during this plan

### Infra
| Commit | Fix |
|--------|-----|
| `c4581aa` | Kafka topics are provisioned consumer-side via admin API (`createTopics`, idempotent, `waitForLeaders`) before the worker connects. Root cause: fresh environments crashed the worker with `UNKNOWN_TOPIC_OR_PARTITION` because nothing created the 13 `EVENT_TOPICS`. |

### Product (real bugs caught by verification)
| Commit | Fix |
|--------|-----|
| `cc9a2b9` | Worker notifications: persist `bookingId` in each channel's payload (dispatcher.ts:82,108,134) and filter trip-reminder dedupe directly on `payload.bookingId` JSON path instead of an arbitrary `findFirst({type,userId})` row — reminders previously re-published forever for multi-booking users. Verified: exactly 1 reminder event where 2 were published before. |
| `76a955a` | apps/web was missing `@tailwindcss/postcss` (required by postcss.config.mjs under Tailwind v4) — **every web route returned 500**. Added devDependency + lockfile; routes render again. |

### Tests
| Commit | Fix |
|--------|-----|
| `8fb878f` | packages/shared had zero test files → vitest exited 1 and failed the repo-wide test gate. Added real money-math unit tests (rounding half-up, gross conservation invariant, boundary percents). |
| `b40cc0f` | The AGENTS.md §7-required idempotency-replay contract test did not exist anywhere. Added apps/api/src/plugins/idempotency.test.ts (hermetic: per-run UUID keys + Redis cleanup). |
| `cb37cee` | Dashboard not-found test used a malformed ref (`NOTEXIST`) that fails format validation → 400, so the not-found branch was untestable by construction. Changed to well-formed-but-unknown `CM-NOTEXIST`. |

### Smoke upgrade (kept triaged rewrite, then made self-contained)
| Commit | Fix |
|--------|-----|
| `dad1ee9` | scripts/smoke-tickets.ts rewrite kept (Task 1 KEEP decision: all imports resolve, self-contained seeding via @camermove/db, in-process `confirmPaymentSuccess`) plus script fixes S1–S7: API-format reference (8 digits after `CM-`), poll windows raised to 90s to cover legitimate dispatcher retry backoff, explicit `process.exit`, per-channel row assertion, temporary phone provisioning so whatsapp fan-out is exercisable, cleanup moved into `finally` with typed deleteMany. |

## Known limitations & deferred follow-ups

- **Accent-sensitive search:** `origin=Yaounde` (ASCII) returns 0 results while `Yaoundé` returns 6 (isolated at API layer). UI unaffected — the search bar always sends accented city names matching DB route names (apps/web/components/search/powerful-search-bar.tsx:16). Deferred as UX/backlog normalization work.
- **ntfy push rows fail in dev:** push channel Notification rows show `failed` because ntfy.sh is unreachable from this network. Rows are still persisted and fan-out/persistence contracts hold; email + whatsapp pass.
- **Port 3001 squatted by Docker Desktop:** web dev server runs on **3002** (`-p 3002`; web package's dev script embeds `-p 3001`, trailing flag wins). Dashboard suite must run with `WEB_URL=http://localhost:3002`. Consider aligning ports in compose/dev docs.
- **NOTCHPAY_BASE_URL points at the live provider** (`https://api.notchpay.co`) and adapters have no stub mode, so the HTTP webhook path was covered by Phase 3 verification; within Plan 0 the confirm step uses the sanctioned in-process `confirmPaymentSuccess()` pattern (same as smoke-tickets TICK-01) to avoid real provider calls.
- **Deploy note for `cc9a2b9`:** pre-existing Notification rows lack `payload.bookingId`, so confirmed bookings inside the 24h reminder window whose reminder was already sent will receive exactly one duplicate reminder after upgrade; mixed-version rolling deploys widen this window.
- **Minor review findings from Tasks 1–7 (deferred, none gate-blocking):**
  - T1 (smoke-tickets triage): Test-5 seed leak on failure paths and silent-catch notification cleanup — both subsequently addressed by `dad1ee9` (cleanup in `finally`, typed deleteMany); remaining: unused `Seeded.route`/`transportId` carried fields, duplicated SQL param in cleanup, docs header omits minio.
  - T3 (tests): fixed 250ms sleep in idempotency test; near-tautological gross-conservation invariant; no out-of-domain refund cases; order-dependent idempotency tests.
  - T5 (boot): double-fault masking in admin `finally` of topic provisioning; no explicit numPartitions/replicationFactor; success-path `admin.disconnect` placement aborts boot if it throws; benign kafkajs `CreateTopics … TOPIC_ALREADY_EXISTS` log line for existing topics (C1 topic provisioning itself resolved by `c4581aa`).
  - T6 (smoke): residual Test-5 count race window; silent `.catch(() => {})` swallows remain on some cleanup lines (scripts/smoke-tickets.ts:249-252); notification dedupe lacks a supporting index — deferred; theoretical concurrent-scan dedup race — deferred.
  - T7 (web): accent-insensitive search UX (above); `TimeoutNegativeWarning` (negative value passed where BullMQ/kafkajs expects a delay, clamped to 1ms) appears in any process importing events/config during Kafka publish — pre-existing, non-fatal, hardening-pass candidate.

## Tracked follow-ups

- **FOLLOWUP-1:** Notification table has zero indexes — add `@@index([type, userId])` migration + concurrency-safe dedupe (unique constraint or SET NX) for trip reminders. Why: today every runTripReminder `findFirst` is a full scan (violates AGENTS.md §1 indexing contract) and multi-replica workers race check-then-act.
- **FOLLOWUP-2:** idempotencyPlugin GET→execute→SET is non-atomic without lock — concurrent identical requests can both execute; the contract test covers sequential replay only. Why: booking/payment idempotency per AGENTS.md §1 needs SET NX or a transactional claim.
- **FOLLOWUP-3:** provision ALL 13 `EVENT_TOPICS` at worker boot (`c4581aa` covers only the 8 handler topics; producer-only topics rely on broker auto-create which production brokers typically disable), with explicit numPartitions sizing.
- **FOLLOWUP-4:** extract `confirmPaymentSuccess` out of apps/api internals so scripts/smoke-tickets.ts stops importing across the app boundary.

## Dead-code sweep (AGENTS.md §3)

`rg -n "dead|TODO|FIXME|unused" --type ts apps packages scripts -g "!*.test.ts"` → **2 hits**, both justified:

- `scripts/smoke-tickets.ts:40,44` — substring match: the identifier `deadline` (poll-timeout bookkeeping for time-boxed waits). Working code, not dead code; left untouched.
- No TODO/FIXME markers, no unused files/exports, no undocumented `{ok:true}` stubs found. The documented `POST /auth/refresh` stub (apps/api/src/auth/routes.ts:45) is the AGENTS.md-sanctioned exception and contains no scan keyword.

No removals required → no sweep commit.

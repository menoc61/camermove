# Plan 0 — Verification Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove Phases 1–4 of CamerMove work end-to-end (typecheck → unit tests → live API/worker → all smoke suites → web critical path) before building Phase 5.

**Architecture:** No new features. Run every AGENTS.md §7 gate against the running docker-compose stack, fix breakage found, and land the pending `scripts/smoke-tickets.ts` upgrade only once it passes.

**Tech Stack:** pnpm workspaces + Turbo, Node >= 22, Prisma 6 / Postgres, Redis, Kafka, MinIO, Fastify (API :3000), Next.js (web :3001), Vitest, tsx smoke scripts.

## Global Constraints

- From spec: "Nothing new gets built until this gate is green."
- Gates verbatim from AGENTS.md §7: `pnpm -r typecheck` 0 errors; `pnpm -r test` all pass incl. concurrent last-seat + idempotency replay; `pnpm smoke` suites pass against running `docker compose up -d`; no unjustified dead-code hits.
- Infra services required: postgres, redis, minio, kafka, mailhog (already Up).
- Never commit secrets; `.env` is gitignored.

---

### Task 1: Triage the uncommitted smoke-tickets.ts upgrade

**Files:**
- Modify (keep or revert): `scripts/smoke-tickets.ts`

**Interfaces:**
- Produces: a committed `scripts/smoke-tickets.ts` runnable via `pnpm smoke:tickets`. Later tasks depend on this suite passing.

- [ ] **Step 1: Read the full working-tree version**

Run: `git diff --stat scripts/smoke-tickets.ts` then read `scripts/smoke-tickets.ts` in full.
Decision rule: keep the new self-contained version (it drives `confirmPaymentSuccess` in-process, needs no provider creds) unless it references files/functions that do not exist.

- [ ] **Step 2: Verify its imports resolve**

Run: `rg -n "confirmPaymentSuccess" apps/api/src/payments/jobs/reconciliation.ts`
Expected: an exported function named `confirmPaymentSuccess` exists.
If missing, locate the real export (`rg -n "export async function confirm" apps/api/src`) and fix the import path/name in the script.

- [ ] **Step 3: Defer execution to Task 6** (suite needs API + worker running). Do not commit yet.

---

### Task 2: Dependencies + typecheck gate

**Files:** none modified (unless fixes needed).

- [ ] **Step 1: Install workspace deps**

Run: `pnpm install`
Expected: `Done` with no ERR-level output; lockfile unchanged (if changed unexpectedly, review `git diff pnpm-lock.yaml` before continuing).

- [ ] **Step 2: Typecheck all packages**

Run: `pnpm -r typecheck`
Expected: exit 0, `0 errors`.
On failure: for each error, read the file, apply the minimal correct fix (no behavior changes), re-run until exit 0. Commit fixes separately:

```bash
git add -A
git commit -m "fix(types): resolve typecheck regressions"
```

---

### Task 3: Unit test gate

**Files:** none modified (unless fixes needed).

- [ ] **Step 1: Run all package tests**

Run: `pnpm -r test`
Expected: exit 0. Must include the concurrent last-seat test and idempotency replay test passing.
On failure: reproduce the single failing test (e.g. `pnpm --filter @camermove/db exec vitest run path/to/test.ts`), diagnose with systematic-debugging discipline (read error, form hypothesis, verify), apply minimal fix, re-run `pnpm -r test` until green. Commit fixes:

```bash
git add -A
git commit -m "fix(tests): <what was broken>"
```

---

### Task 4: Database migration state

**Files:** none modified (migrations already exist under `packages/db/prisma/migrations`).

- [ ] **Step 1: Confirm migrations applied**

Run: `pnpm --filter @camermove/db exec prisma migrate status`
Expected: `Database schema is up to date!`
If pending: `pnpm --filter @camermove/db exec prisma migrate deploy`, then re-run status.

- [ ] **Step 2: Confirm seed data present**

Run: `docker compose exec postgres psql -U postgres -d camermove -c "select count(*) from \"User\"; select count(*) from \"Trip\";"`
Expected: both counts > 0.
If 0 rows: find seed script (`Get-ChildItem packages/db/prisma -Name seed*`, then `pnpm --filter @camermove db:seed` or equivalent from `packages/db/package.json`) and run it.

---

### Task 5: Boot API + worker

**Files:** none modified.

- [ ] **Step 1: Start API dev server (background)**

Run (background): `pnpm --filter @camermove/api dev`
Wait for log line containing `Server listening at http://` (port 3000).

- [ ] **Step 2: Health check**

Run: `Invoke-RestMethod http://localhost:3000/health | ConvertTo-Json -Compress`
Expected: JSON with `status` ok/healthy field.

- [ ] **Step 3: Start worker dev server (background)**

Run (background): `pnpm --filter @camermove/worker dev`
Expected: log lines showing Kafka consumer subscribed (topics incl. `booking.created`, `payment.confirmed`, `ticket.issued`).

---

### Task 6: Smoke suites (auth+search, tickets, dashboard)

**Files:**
- Possibly commit: `scripts/smoke-tickets.ts`

- [ ] **Step 1: Auth + search smoke**

Run: `pnpm smoke`
Expected: all assertions ✓, exit 0.

- [ ] **Step 2: Tickets & notifications smoke (new self-contained version)**

Run: `pnpm smoke:tickets`
Expected: Tests 1–5 all ✓, exit 0.
If Test 4/5 fail due to worker not consuming: confirm Task 5 Step 3 process alive; retry once after 10s. If still failing, fix root cause (consumer group/topic name mismatch) before proceeding.

- [ ] **Step 3: Dashboard smoke**

Run: `pnpm smoke:dashboard`
Expected: 5/5 tests ✓, exit 0.

- [ ] **Step 4: Commit the kept smoke upgrade**

```bash
git add scripts/smoke-tickets.ts
git commit -m "test(smoke): make tickets suite self-contained (in-process confirm + worker coverage)"
```

---

### Task 7: Web critical path check

**Files:** none modified (unless bugs found).

- [ ] **Step 1: Start web dev server (background)**

Run (background): `pnpm --filter @camermove/web dev`
Expected: `Ready` on port 3001.

- [ ] **Step 2: Verify pages render server-side without errors**

Run:
```powershell
(Invoke-WebRequest http://localhost:3001/ -UseBasicParsing).StatusCode
(Invoke-WebRequest "http://localhost:3001/results?origin=Yaounde&destination=Douala&date=2026-09-01&pax=1" -UseBasicParsing).StatusCode
(Invoke-WebRequest http://localhost:3001/tickets/lookup -UseBasicParsing).StatusCode
```
Expected: `200` for each.
On non-200: read the terminal stack trace, fix, re-run. Any data-dependent failure must be reproduced via the corresponding API call first (`Invoke-RestMethod http://localhost:3000/api/v1/search?...`) to isolate API vs web.

- [ ] **Step 3: Record manual booking-path result**

Walk the flow headlessly as far as HTTP allows: create user (`POST /api/v1/auth/register`), search, hold seats (`POST /api/v1/bookings` with `Idempotency-Key`), confirm payment through the sandbox/stub path, fetch ticket. Log each status code. Expected chain: 201 → 200 → 201 → confirmed → 200 ticket with `verificationCode`.
Any break here = blocking bug: fix, re-run Task 6 suites, then repeat this step.

---

### Task 8: Dead-code sweep + final gate report

**Files:** possibly small deletions.

- [ ] **Step 1: Dead-code scan**

Run: `rg -n "dead|TODO|FIXME|unused" --type ts apps packages scripts -g "!*.test.ts"`
Expected: every hit either pre-justified (documented stub like `POST /auth/refresh`) or removed in this task. Commit removals:

```bash
git add -A
git commit -m "chore: remove dead code flagged by sweep"
```

- [ ] **Step 2: Final combined gate**

Run: `pnpm -r typecheck; pnpm -r test; pnpm smoke; pnpm smoke:tickets; pnpm smoke:dashboard`
Expected: every command exit 0.

- [ ] **Step 3: Write verification report**

Create `docs/superpowers/plans/2026-08-25-plan-0-verification-report.md` with: date, commit hash, per-gate pass/fail, fixes made, known limitations. Commit:

```bash
git add docs/superpowers/plans/2026-08-25-plan-0-verification-report.md
git commit -m "docs(plan-0): verification gate report — Phases 1-4 green"
```

Gate cleared → proceed to Plan 1 (Partner application + MinIO presigned docs, TRANS-01).

# CamerMove — Full-App Verification + Phase 5 Design

**Date:** 2026-08-25
**Status:** Approved
**Scope:** (a) Verify Phases 1–4 work end-to-end; (b) build all of Phase 5 (Transporter portal, Admin back-office, public content) as vertical slices delivering API + web together.

## Context

CamerMove is a pnpm + Turbo monorepo: `apps/api` (Fastify), `apps/web` (Next.js 16 / React 19 / Tailwind 4 / TanStack Query / Zustand), `apps/worker` (Kafka + BullMQ), `packages/{db,config,shared,media,events,frontend,observability}`. Infra via docker-compose (Postgres, Redis, Kafka, MinIO, Grafana/Prometheus/OTel). Phases 1–4 are implemented and previously verified: search, auth+RBAC, booking with atomic seat holds, dual-provider payments (NotchPay/CinetPay) with webhooks and transactional confirmation, e-tickets with QR, notifications, traveler dashboard.

The Prisma schema already contains every model Phase 5 needs: `Transporter`, `Vehicle`, `Route`, `Trip`, `Document`, `PartnerApplication`, `Commission`, `AppSettings`, `AuditLog`. Roles exist: `traveler`, `transporter_staff`, `admin`, `super_admin`. `apps/api/src/admin/settings.ts` already implements superadmin settings. AGENTS.md is the engineering contract (statelessness, idempotency, ACID seat writes, caching, indexing, rate limiting, async processing, RBAC, metadata, no dead code, settings from DB).

## Part A — Step 0: Verification gate (no new features until green)

1. Review uncommitted change in `scripts/smoke-tickets.ts`; keep or discard.
2. Boot stack: `docker compose up -d`; `pnpm install`; Prisma migrate deploy.
3. Gates per AGENTS.md §7:
   - `pnpm -r typecheck` → 0 errors
   - `pnpm -r test` → all pass (includes concurrent last-seat and idempotency replay)
   - Smoke suites against running stack: `pnpm smoke` (auth, search), `smoke:tickets`, `smoke:dashboard`
4. Web critical path check: home → search results → trip detail → book → pay (mock/provider sandbox) → ticket w/ QR → dashboard.
5. Fix all breakage found. Only then proceed to Part B.

## Part B — Phase 5 architecture (Option A: one app, vertical slices)

### Backend

New Fastify modules following existing conventions (`schema/service/repository/routes/types`, Zod validation on every endpoint, `Idempotency-Key` support on writes, `metadataPlugin` fields logged and persisted where relevant):

- **`src/transporter/`**
  - Partner application: submit application, MinIO presigned upload URLs for documents (`packages/media`), own-application status (TRANS-01).
  - Profile & fleet: transporter profile CRUD, vehicles CRUD with status transitions (TRANS-02a).
  - Routes & schedules: routes CRUD; trip/schedule creation incl. bulk create; pause/close offer (TRANS-02b).
  - Bookings & payments for own trips: list with `dateFrom/dateTo`, filters, pagination, CSV export (TRANS-03).
- **`src/admin/`** (extends existing module)
  - Users: list/detail/ban-unban.
  - Transporters: approve/suspend/reject; partner-application review queue; set commission % global + per-transporter (ADMIN-01/02).
  - Operations: trips/bookings/payments management with bulk endpoints, refunds, cancellations.
  - Insight: commission reports, stats dashboard, audit-log listing, exports with date ranges (ADMIN-03).

Every admin mutation writes `AuditLog` with actor id, role, ip, and action payload. All list endpoints support `dateFrom/dateTo` and `/export?format=json|csv` per AGENTS.md §6.

### Frontend (same Next.js app)

Role-gated route groups; `middleware.ts` enforces role cookies before rendering:

- **`/transporter/*`**: apply wizard (multi-step with document uploads), dashboard, fleet management, routes & schedules editor (datepicker-driven), pricing/capacity editors, bookings & payments tables with export button.
- **`/admin/*`**: users, transporters, applications review, operations tables (trips/bookings/payments) with bulk actions, commissions report, settings form wired to existing `/api/v1/admin/settings`, audit log viewer, stats cards/charts.
- **Public pages**: how-it-works, become-partner, FAQ, contact, legal — mobile-first, reusing `THEME_TOKENS` (teal `#0e9f8f`, accent `#f4b607`) and existing component patterns.

Data fetching via TanStack Query through `lib/api/*` helpers extending `lib/api/client.ts`. Forms validated client-side with Zod schemas mirroring API schemas.

## Execution slices (each ships API + web together)

| # | Slice | Requirements |
|---|-------|--------------|
| 0 | Verification gate | AGENTS §7 |
| 1 | Partner application + MinIO presigned docs | TRANS-01 |
| 2 | Transporter profile + fleet | TRANS-02a |
| 3 | Routes & schedules (+bulk trips) | TRANS-02b |
| 4 | Transporter bookings & payments view | TRANS-03 |
| 5 | Admin people (users, transporters, applications→commission) | ADMIN-01a/02 |
| 6 | Admin operations & money (trips/bookings/payments/commissions/settings) | ADMIN-01b |
| 7 | Admin insight (stats, audit log, reports, exports) | ADMIN-03 |
| 8 | Public content pages | Phase 5 SC-3 |
| 9 | Final verification + phase-5 smoke suite | all |

## Error handling, security, quality

- Zod on every endpoint; typed error envelope; 409 for state conflicts (duplicate application, invalid transition); 403 RBAC denials tested negatively in unit tests.
- Idempotency keys on all POST/PUT/PATCH (24h Redis replay).
- Rate limiting on public contact/application endpoints (IP + app layers).
- Presigned URLs short-TTL, content-type constrained; no raw document bytes through the API.
- New list queries checked with `EXPLAIN ANALYZE`; indexes added when needed.
- Unit tests per service; smoke suites extended (`smoke:phase5`) covering apply→approve→publish trip→book→pay→ticket across roles.
- No dead code: every new file imported or explicitly excluded; commented code removed before commits.

## Out of scope

- Native mobile apps (future consumers of the same REST API).
- Real payout/settlement engine beyond commission reporting.
- Multi-language UI (i18n scaffolding exists but translations not expanded here).

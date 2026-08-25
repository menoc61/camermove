# AGENTS.md — CamerMove Engineering Principles

> **All agents (human or AI) MUST follow these principles. Every endpoint, every module, every commit is checked against this document.**

## 1. Principles (non-negotiable)

- **Statelessness** — API is stateless (JWT `Authorization: Bearer`, no server session). Every request carries its own auth. Horizontal scale behind a load balancer must work with zero sticky state.
- **Idempotency** — Every `POST/PUT/PATCH` accepts `Idempotency-Key`. Replay returns the same `status+body` from Redis (24h) without re-executing. Booking and payment creation are idempotent.
- **ACID** — All seat-booking writes are inside Prisma `$transaction` with `SELECT … FOR UPDATE` row locks. Postgres triggers (`trg_seat_check`, `trg_booking_status`) enforce invariants transactionally. No double-booking.
- **Caching** — `cache.ts` + `getRedis()` (ioredis) with `cacheKey(prefix, sortedParams)` and 60s TTL for search. Invalidate on write. Fallback to memory if Redis unavailable.
- **Proper indexing** — `Trip @@index([departureAt],[price],[status],[routeId,departureAt])`, `Booking @@index([userId,status],[tripId],[status,holdExpiresAt])`. Every `WHERE`/`ORDER BY` field is indexed. Check with `EXPLAIN ANALYZE`.
- **Rate limiting** — Dual-layer: IP per route (`RATE_LIMIT_IP_*`) + app-wide per route (`RATE_LIMIT_APP_*`), both `RATE_LIMIT_WINDOW_MS`, via Redis (shared) with memory fallback. `429` with `Retry-After`.
- **Async processing** — Kafka (durable event backbone, `booking.created` etc.) + BullMQ (delayed `holdExpiresAt`, trip reminders). `apps/worker` is the consumer. No business logic blocks the request path.
- **Decoupling via APIs** — Business logic only in `apps/api` + `packages/*`. `apps/web` only calls `REST /api/v1`. Versioned, Zod-validated, OpenAPI at `/docs`. Future mobile reuses the same API. No direct DB access across modules.
- **Robust security** — `argon2` passwords, RBAC `requireAuth(role?)` at API layer, Zod on every endpoint, `X-Notch-Signature` webhook verify, `AuditLog`, helmet-ready CORS, no raw card data, secrets only via `loadEnv()` from `.env` (gitignored).
- **Horizontal scalability** — Stateless API + Redis (rate-limit/cache/idempotency/seat-hold) + Postgres read-replicas ready + Kafka partitions + `trustProxy` + `/health` + graceful `SIGTERM`. No local state.

## 2. Endpoint Metadata (per-endpoint, not generic)

Every endpoint MUST log and, where relevant, persist endpoint-specific metadata via `metadataPlugin` (`req.meta` = `ip, os, browser, device, ua, referer, requestId`) **plus** handler-specific fields:

| Endpoint | Additional metadata (logged + stored where noted) |
|----------|---------------------------------------------------|
| `POST /auth/register, /auth/login` | `email` (hashed), `ip`, `os`, `browser` → `AuditLog` |
| `GET /auth/google*` | `provider=google`, `state`, `ip` |
| `GET /search, /search/advanced` | `origin, destination, date, pax, filters, sort, page/limit, ip, os` → cache key, Prometheus `search_requests_total{origin,destination}` |
| `POST /bookings` | `tripId, seatCount, passengerCount, totalAmount, ip, os, browser, device, userId` → `AuditLog` + Kafka `booking.created` |
| `POST /bookings/:id/cancel` | `bookingId, userId, ip` |
| `POST /payments` | `bookingId, amount, provider, ip, ua` → `Payment.webhookPayload` audit |
| `POST /tickets/*` | `bookingId, verificationCode` |
| `GET /trips/:id, /bookings/:id` | `entityId, userId, ip` |
| `POST /trips/bulk, /bookings/bulk/*` | `ids[], action, actorId, ip` → `AuditLog` |
| `GET /admin/*` | `actorId, role, ip, query filters` → `AuditLog` |

**Implementation:** `req.meta` is always present. Handlers add `req.log.info({ ...req.meta, tripId, seatCount }, "booking.create")` and, for writes, include the same fields in `AuditLog.metadata` or `Notification.payload`.

## 3. No Dead Code

- Every file must be imported or explicitly excluded (e.g., `views/*.sql` is applied via migration, not imported). `pnpm -r typecheck` and `knip` (when added) must report 0 unused files/exports.
- Remove commented code, unused `// TODO` without issue link, and stub handlers that return `{ ok: true }` — either implement or delete. `POST /auth/refresh` is the only allowed stub (documented as TODO with issue).
- Before each bulk commit, run `rg -n "dead|TODO|FIXME|unused" --type ts` and justify or remove matches.

## 4. Scalable & Maintainable

- **Modular monorepo** (`apps/web,api,worker` + `packages/shared,db,config,media,events,frontend,observability`) — one module = one directory with `schema.ts, service.ts, repository.ts, routes.ts, types.ts`. Controllers thin, business rules in services, unit-tested.
- **Single data-access layer** `packages/db` — all Prisma access via repositories, no cross-module `prisma.*` calls.
- **Typed config** `packages/config` — single Zod `EnvSchema`, no `process.env` elsewhere, every `max` in `.env` (see `RATE_LIMIT_*`, `PAGINATION_*`, `BULK_MAX_IDS`, `SEARCH_*`).
- **Shared math** `packages/shared` — money/commission logic once, reused by API and future mobile.
- **Small files** — any file >300 lines is a split candidate. Prefer focused files over large ones.

## 5. App Settings (Superadmin)

- Model `AppSettings` (singleton row, `id="global"`) holds: `commissionPercent`, `holdExpiryMinutes`, `cancellationPolicy`, `smtp` overrides, `featureFlags`, `maintenanceMode`. Only `super_admin` can `GET/PUT /api/v1/admin/settings`.
- Every service reads settings from DB (cached 30s via Redis) instead of hardcoded constants. Changing settings never requires a redeploy.

## 6. Exportable & Periodic (Datepicker)

- Every list endpoint that is periodic (bookings, payments, commissions, trips, audit logs, notifications) supports `dateFrom/dateTo` (ISO `YYYY-MM-DD`) and `GET /…/export?dateFrom&dateTo&format=json|csv`.
- Export returns a streamed `text/csv` (or `application/json`) with `Content-Disposition: attachment; filename="export-{resource}-{from}-{to}.csv"`, respects the same `filter/q/groupBy/orderBy` as the list endpoint, and enforces `RBAC` + `limit` from `SEARCH_MAX_LIMIT`.
- Frontend uses a datepicker (two `input type="date"`) for every exportable table; `ExportButton` component handles `dateFrom/dateTo` + `format` and triggers download.

## 7. Verification Before Completion

- `pnpm -r typecheck` — 0 errors
- `pnpm -r test` — all tests pass, including concurrent last-seat and idempotency replay tests
- `pnpm smoke` (`pnpm smoke:auth`, `pnpm smoke:search`) — smoke suites pass against running `docker compose up -d`
- No `rg` dead-code hits without justification

---

*This document is the contract. If a change violates a principle here, the change is wrong — not the document.*

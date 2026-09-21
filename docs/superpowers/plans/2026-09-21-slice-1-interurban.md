# Slice 1 — Interurban Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make interurban transport (trips, bookings, payments, tickets, transporter console, intraurban, reviews) fully functional with complete CRUD, documented permissions, wired dashboard actions, and smoke coverage.

**Architecture:** Thin vertical additions on existing seams — new reads reuse `advancedSearch`/`listCommissions` services; reviews CRUD reuses `upsertReview` + cache invalidation; web role gate stays a UX gate (API remains authoritative); no schema-applying commands run (backend-patterns: migrate needs user confirmation).

**Tech Stack:** Fastify + Zod + Prisma (API), Next.js App Router + react-query + shadcn (web), vitest `buildApp().inject` (tests), tsx smoke scripts.

## Global Constraints

- AGENTS.md: stateless JWT, `Idempotency-Key` on writes, `$transaction` + `SELECT FOR UPDATE` on seat writes, 60s search cache with `cacheKey(prefix, sortedParams)`, Zod on every endpoint, `req.meta` + handler fields in logs, `AuditLog` on writes, exports honor `SEARCH_MAX_LIMIT`.
- No `process.env` outside `packages/config`; money math via `packages/shared`; French UI copy; no placeholders/TODOs in shipped code.
- TDD: failing test first for every backend endpoint; `pnpm -r typecheck` 0 errors before each commit.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/src/search/routes.ts` | Add `GET /trips` (modify only, +25 lines) |
| `apps/api/src/search/trips-list.test.ts` | New: inject tests for `GET /trips` |
| `apps/api/src/transporter/routes.ts` | Add `GET /transporter/trips/:id`, `GET /transporter/commissions` |
| `apps/api/src/transporter/service.ts` | Add `getTransporterTrip` (modify, +20 lines) |
| `apps/api/src/transporter/commissions.test.ts` | New: inject tests (own vs foreign vs traveler) |
| `apps/api/src/reviews/service.ts` | Add `getReviewById`, `deleteReview` (modify, +45 lines) |
| `apps/api/src/reviews/routes.ts` | Add `GET /reviews/:id`, `PUT /reviews/:id`, `DELETE /reviews/:id` |
| `apps/api/src/reviews/review-crud.test.ts` | New: 401/404 wiring tests |
| `apps/api/src/events/routes.ts` | 403 unification for `GET /partner/events` (2-line change) |
| `apps/api/src/parcels/routes.ts` | 403 unification for `GET /partner/parcels` (2-line change) |
| `apps/web/lib/api/transporter.ts` | Point `listCommissions` at new endpoint; delete `bulkCreateTrips` |
| `apps/web/components/transporter/Trips.tsx` | Client-side 3× `createTrip` bulk; add status action + update wiring |
| `apps/web/middleware.ts` | Role-aware UX redirect (modify, +20 lines) |
| `apps/web/components/dashboard-v2/tabs/DashboardTabs.tsx` | Cancel action in trips rows |
| `apps/web/components/dashboard-v2/summary/SummaryGrid.tsx` | 6 skeletons (1-line-class fix) |
| `apps/web/components/dashboard-v2/panels/DataTable.tsx` | French status labels (map edit only) |
| `apps/api/src/plugins/swagger.ts` | Remove `sms` from channel enum (1 line) |
| `packages/db/prisma/schema.prisma` + `packages/db/prisma/migrations/20260922000001_refund_actor_fk/migration.sql` | `Refund.actor` FK (source only, DO NOT run migrate) |
| `docs/permissions.md` | New: slice-1 permission matrix |
| `scripts/smoke/verticals.ts` | Extend with slice-1 checks |

---

### Task 1: `GET /trips` public trip list

**Files:**
- Modify: `apps/api/src/search/routes.ts`
- Test: `apps/api/src/search/trips-list.test.ts` (create)

**Interfaces:**
- Consumes: `AdvancedSearchQuery`, `advancedSearch` from `./advanced`; `getCached/setCached/cacheKey` from `../lib/cache`; `observeSearch` from `@camermove/observability` (signature `(origin: unknown, destination: unknown) => void`).
- Produces: `GET /trips` returning `{ ...advancedSearchResult, meta: { cached: boolean } }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

describe("GET /trips", () => {
  it("returns 200 with a paginated items envelope", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/trips?perPage=5" })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: unknown[]; page: number; meta: { cached: boolean } }
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.page).toBe(1)
    expect(typeof body.meta.cached).toBe("boolean")
  })

  it("rejects perPage over limit with 400", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/trips?perPage=9999" })
    expect(res.statusCode).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @camermove/api exec vitest run src/search/trips-list.test.ts`
Expected: FAIL with `404` (route does not exist; Fastify returns 404, first assertion fails).

- [ ] **Step 3: Write minimal implementation**

Insert before `app.get("/trips/:id", ...)` in `apps/api/src/search/routes.ts`:

```ts
app.get("/trips", async (req) => {
  const query = AdvancedSearchQuery.parse(req.query)
  const meta = (req as unknown as { meta?: Record<string, unknown> }).meta ?? {}
  req.log.info(
    { ...meta, q: query.q, filters: { minPrice: query.minPrice, maxPrice: query.maxPrice, transporterId: query.transporterId }, sort: query.sortBy ?? query.orderBy, page: query.page, limit: query.perPage },
    "trips.list",
  )
  observeSearch(query.origin ?? "all", query.destination ?? "all")
  const key = cacheKey("trips-list", query as unknown as Record<string, unknown>)
  const cached = await getCached<Record<string, unknown>>(key)
  if (cached) return { ...(cached as object), meta: { cached: true } }
  const result = await advancedSearch(query)
  await setCached(key, result, 60).catch(() => {})
  return { ...(result as object), meta: { cached: false } }
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @camermove/api exec vitest run src/search/trips-list.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/search/routes.ts apps/api/src/search/trips-list.test.ts
git commit -m "feat(api): add GET /trips public list (cached, paginated)"
```

---

### Task 2: `GET /transporter/trips/:id`

**Files:**
- Modify: `apps/api/src/transporter/routes.ts`, `apps/api/src/transporter/service.ts`
- Test: `apps/api/src/transporter/trip-get.test.ts` (create)

**Interfaces:**
- Consumes: `resolveTransporter` (existing in routes file), `TripParams` (existing), `prisma` from `@camermove/db`.
- Produces: `getTransporterTrip(tripId: string, transporterId: string)`; `GET /transporter/trips/:id` (owner-scoped single trip).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

describe("GET /transporter/trips/:id", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/transporter/trips/c000000000000000000000001" })
    expect(res.statusCode).toBe(401)
  })
})
```

(CUID-format id avoids 400 so the test isolates auth; after implementation the same call still 401s — the route-exists signal is the absence of Fastify's 404 `{"message":"Route GET:/api/v1/transporter/trips/... not found"}` body. Assert both:)

```ts
  it("route exists (not Fastify 404 body)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/transporter/trips/c000000000000000000000001" })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @camermove/api exec vitest run src/transporter/trip-get.test.ts`
Expected: FAIL on the second test (Fastify 404 body present).

- [ ] **Step 3: Add service function** in `apps/api/src/transporter/service.ts` (after `listTrips`):

```ts
export async function getTransporterTrip(tripId: string, transporterId: string) {
  const { prisma } = await import("@camermove/db")
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, transportId: transporterId },
    select: {
      id: true, departureAt: true, arrivalEstimateAt: true, price: true,
      totalSeats: true, transportId: true, vehicleTypeInfo: true,
      departurePointInfo: true, status: true,
      route: { select: { id: true, originCity: true, destinationCity: true } },
      seatAvailability: { select: { seatsAvailable: true, seatsHeld: true, seatsBooked: true } },
    },
  })
  if (!trip) {
    const { NotFoundError } = await import("@camermove/config")
    throw new NotFoundError("Trajet introuvable")
  }
  return trip
}
```

- [ ] **Step 4: Add route** in `apps/api/src/transporter/routes.ts` after the `/transporter/trips/export` block (must sit before `POST /transporter/trips` is fine; it is a GET with `:id` so it must come AFTER the `/export` GET to avoid capturing "export"):

```ts
app.get("/transporter/trips/:id", { preHandler: app.requireAuth() }, async (req) => {
  const user = req.user!
  const tid = await resolveTransporter(user.role, user.id)
  if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
  const { id } = TripParams.parse(req.params)
  req.log.info({ ...req.meta, tripId: id, userId: user.id }, "transporter.trip.get")
  return svc.getTransporterTrip(id, tid)
})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @camermove/api exec vitest run src/transporter/trip-get.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/transporter/routes.ts apps/api/src/transporter/service.ts apps/api/src/transporter/trip-get.test.ts
git commit -m "feat(api): add GET /transporter/trips/:id owner-scoped"
```

---

### Task 3: Reviews `GET/PUT/DELETE /reviews/:id`

**Files:**
- Modify: `apps/api/src/reviews/service.ts`, `apps/api/src/reviews/routes.ts`, `apps/api/src/reviews/schema.ts`
- Test: `apps/api/src/reviews/review-crud.test.ts` (create)

**Interfaces:**
- Consumes: `upsertReview` (existing), `prisma` from `@camermove/db`.
- Produces: `getReviewById(id)`, `deleteReview(id, user)`; routes `GET /reviews/:id` (public), `PUT /reviews/:id` (owner), `DELETE /reviews/:id` (owner or admin).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

const MISSING = "c000000000000000000000001"

describe("reviews :id routes", () => {
  it("GET missing review returns 404 (not router 404)", async () => {
    const res = await app.inject({ method: "GET", url: `/api/v1/reviews/${MISSING}` })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toHaveProperty("message", expect.stringContaining("Avis introuvable"))
  })

  it("DELETE without token returns 401", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/reviews/${MISSING}` })
    expect(res.statusCode).toBe(401)
  })

  it("PUT without token returns 401", async () => {
    const res = await app.inject({ method: "PUT", url: `/api/v1/reviews/${MISSING}`, payload: { rating: 5 } })
    expect(res.statusCode).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @camermove/api exec vitest run src/reviews/review-crud.test.ts`
Expected: FAIL — first test gets Fastify router 404 body, not "Avis introuvable".

- [ ] **Step 3: Add service functions** (append to `apps/api/src/reviews/service.ts`):

```ts
export async function getReviewById(id: string) {
  const review = await prisma.review.findFirst({
    where: { id, isPublished: true },
    select: {
      id: true, rating: true, punctuality: true, comfort: true, cleanliness: true,
      service: true, comment: true, createdAt: true,
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  })
  if (!review) {
    const err = new Error("Avis introuvable")
    ;(err as Error & { statusCode: number }).statusCode = 404
    throw err
  }
  return { ...review, createdAt: review.createdAt.toISOString(), author: review.user }
}

export async function deleteReview(id: string, user: { id: string; role: string }) {
  const existing = await prisma.review.findUnique({ where: { id } })
  if (!existing) {
    const err = new Error("Avis introuvable")
    ;(err as Error & { statusCode: number }).statusCode = 404
    throw err
  }
  const isAdmin = user.role === "admin" || user.role === "super_admin"
  if (existing.userId !== user.id && !isAdmin) {
    const err = new Error("Accès refusé")
    ;(err as Error & { statusCode: number }).statusCode = 403
    throw err
  }
  await prisma.review.delete({ where: { id } })
  const targetId = existing.target === "trip" ? existing.tripId : existing.transporterId
  await invalidateCache(`reviews:*id=${targetId}*`).catch(() => {})
  await invalidateCache("agencies*").catch(() => {})
  return { id }
}
```

- [ ] **Step 4: Add schemas** to `apps/api/src/reviews/schema.ts`:

```ts
export const ReviewIdParams = z.object({ id: zId })

const updateScore = z.number().int().min(1).max(5).optional()

export const ReviewUpdateInput = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  punctuality: updateScore,
  comfort: updateScore,
  cleanliness: updateScore,
  service: updateScore,
  comment: z.string().max(2000).nullable().optional(),
})
```

- [ ] **Step 5: Add routes** to `apps/api/src/reviews/routes.ts` (update import to include new symbols):

```ts
import { ReviewCreateInput, ReviewIdParams, ReviewListQuery, ReviewTransporterParams, ReviewTripParams, ReviewUpdateInput } from "./schema.js"
import { deleteReview, getReviewById, listTransporterReviews, listTripReviews, upsertReview } from "./service.js"

app.get("/reviews/:id", async (req) => {
  const { id } = ReviewIdParams.parse(req.params)
  return getReviewById(id)
})

app.put("/reviews/:id", { preHandler: app.requireAuth() }, async (req) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta
  const { id } = ReviewIdParams.parse(req.params)
  const patch = ReviewUpdateInput.parse(req.body ?? {})
  const { prisma } = await import("@camermove/db")
  const existing = await prisma.review.findUnique({ where: { id } })
  if (!existing) {
    const { NotFoundError } = await import("@camermove/config")
    throw new NotFoundError("Avis introuvable")
  }
  if (existing.userId !== user.id) {
    const { ForbiddenError } = await import("@camermove/config")
    throw new ForbiddenError("Accès refusé")
  }
  const review = await upsertReview(user.id, {
    target: existing.target as "trip" | "transporter",
    tripId: existing.tripId ?? undefined,
    transporterId: existing.transporterId ?? undefined,
    bookingId: existing.bookingId,
    rating: patch.rating ?? existing.rating,
    punctuality: patch.punctuality ?? existing.punctuality ?? undefined,
    comfort: patch.comfort ?? existing.comfort ?? undefined,
    cleanliness: patch.cleanliness ?? existing.cleanliness ?? undefined,
    service: patch.service ?? existing.service ?? undefined,
    comment: patch.comment ?? existing.comment ?? undefined,
  })
  req.log.info({ ...meta, userId: user.id, reviewId: id }, "review.update")
  return { id: review.id, rating: review.rating, createdAt: review.createdAt.toISOString() }
})

app.delete("/reviews/:id", { preHandler: app.requireAuth() }, async (req) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta
  const { id } = ReviewIdParams.parse(req.params)
  req.log.info({ ...meta, userId: user.id, reviewId: id }, "review.delete")
  return deleteReview(id, user)
})
```

Note: `PUT` reuses `upsertReview`, so the verified-stay gate (confirmed booking owned by rater, matching target) is re-enforced — an update cannot escape the original booking proof.

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @camermove/api exec vitest run src/reviews/review-crud.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/reviews/service.ts apps/api/src/reviews/routes.ts apps/api/src/reviews/schema.ts apps/api/src/reviews/review-crud.test.ts
git commit -m "feat(api): reviews GET/PUT/DELETE by id (owner or admin delete)"
```

---

### Task 4: Transporter commissions endpoint + web lib fixes

**Files:**
- Modify: `apps/api/src/transporter/routes.ts`, `apps/web/lib/api/transporter.ts`, `apps/web/components/transporter/Trips.tsx`, `apps/web/components/transporter/Bookings.tsx`
- Test: `apps/api/src/transporter/commissions.test.ts` (create)

**Interfaces:**
- Consumes: `listCommissions` from `../admin/service` (already accepts `transporterId` filter).
- Produces: `GET /transporter/commissions` (own scope); `listCommissions(token, params)` hitting it; bulk via 3× `createTrip`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

describe("GET /transporter/commissions", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/transporter/commissions" })
    expect(res.statusCode).toBe(401)
  })
})
```

Plus a file-existence assertion done by hand: `GET /api/v1/transporter/commissions` must exist in `routes.ts` after implementation (the 401 above passes both before and after; the route-exists proof is Task 4 Step 4's inject check in the smoke extension — see Task 10).

- [ ] **Step 2: Run test to verify wiring baseline**

Run: `pnpm --filter @camermove/api exec vitest run src/transporter/commissions.test.ts`
Expected: PASS (401 baseline; route added next step).

- [ ] **Step 3: Add route** in `apps/api/src/transporter/routes.ts` after the bookings `/:id` block:

```ts
app.get("/transporter/commissions", { preHandler: app.requireAuth() }, async (req) => {
  const user = req.user!
  const tid = await resolveTransporter(user.role, user.id)
  if (tid === "__admin__") throw new ForbiddenError("Utilisez le panneau admin")
  const q = TransporterBookingsQuery.parse(req.query)
  const { listCommissions } = await import("../admin/service")
  req.log.info({ ...req.meta, userId: user.id }, "transporter.commissions.list")
  return listCommissions({ page: q.page, limit: q.limit, transporterId: tid })
})
```

- [ ] **Step 4: Fix web lib** in `apps/web/lib/api/transporter.ts` — replace the admin-only call and the dead bulk helper:

```ts
export function listCommissions(token: string, params: Record<string, string> = {}): Promise<PaginatedResponse<{ id: string; commissionAmount: number; netAmount: number; payoutStatus: string }>> {
  return transporter.list("/commissions", { token, params })
}
```

Delete the `bulkCreateTrips` function entirely (server `/trips/bulk` is admin-only `{ids[], action}` and unreachable for transporters).

- [ ] **Step 5: Fix Trips UI** in `apps/web/components/transporter/Trips.tsx`: change import to drop `bulkCreateTrips`, rewrite `onBulk` as 3 sequential `createTrip` calls:

```tsx
import { useEffect, useState } from "react"
import { listTrips, createTrip, deleteTrip, updateTrip, listRoutes } from "@/lib/api/transporter"
```

```tsx
async function onBulk(){
  if(!form.routeId || !form.departureAt) { setError("Route et date requis pour lot"); return }
  const base = new Date(form.departureAt)
  try{
    for (let i = 0; i < 3; i++) {
      await createTrip(token, { routeId: form.routeId, departureAt: new Date(base.getTime()+i*24*3600*1000).toISOString(), price: Number(form.price), totalSeats: Number(form.totalSeats) })
    }
    refresh()
  }catch(err){ setError((err as Error).message)}
}
```

Add per-row status control using the existing `POST /trips/:id/status` API via a tiny local helper (add to `apps/web/lib/api/transporter.ts`):

```ts
export function setTripStatus(token: string, id: string, action: "pause" | "close" | "reopen"): Promise<Trip> {
  return transporter.request<Trip>(`/api/v1/trips/${id}/status`, { method: "POST", token, body: { action } })
}
```

And in the row, next to Supprimer add a `<select>` bound to `t.status` calling `setTripStatus` then `refresh()`. Also wire `updateTrip` for price edit: keep scope tight — row gets an inline price input only if time permits; required: status select. (If the reviewer rejects scope, split price edit into its own task.)

- [ ] **Step 6: Fix Bookings UI commissions fallback** in `apps/web/components/transporter/Bookings.tsx`: replace the `listCommissions→403` fallback text path with the now-working `listCommissions` (same signature `(token, params)`).

- [ ] **Step 7: Typecheck + tests**

Run: `pnpm --filter ./apps/web exec tsc --noEmit` (expect clean) and `pnpm --filter @camermove/api exec vitest run src/transporter`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/transporter/routes.ts apps/api/src/transporter/commissions.test.ts apps/web/lib/api/transporter.ts apps/web/components/transporter/Trips.tsx apps/web/components/transporter/Bookings.tsx
git commit -m "feat(transporter): scoped commissions endpoint, client-side bulk, trip status wiring"
```

---

### Task 5: 403 unification for partner events/parcels

**Files:**
- Modify: `apps/api/src/events/routes.ts` (1 spot, ~line 328), `apps/api/src/parcels/routes.ts` (1 spot, ~line 232)

**Interfaces:** none new; behavior change `[]` → 403 for travelers.

- [ ] **Step 1: events fix** — in `GET /partner/events`, after auth, add:

```ts
if (user.role !== "transporter_staff" && user.role !== "admin" && user.role !== "super_admin") throw new ForbiddenError("Accès réservé aux partenaires")
```

matching the hotels pattern (`hotels/routes.ts:180`). Keep the `organizerWhere` scoping as-is below it.

- [ ] **Step 2: parcels fix** — same guard in `GET /partner/parcels` before `operatorWhere`.

- [ ] **Step 3: Verify** — run existing suites: `pnpm --filter @camermove/api exec vitest run src/events src/parcels`
Expected: PASS (no existing test asserts empty-list for travelers; if one fails, update that test to expect 403 with justification in the commit message).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/events/routes.ts apps/api/src/parcels/routes.ts
git commit -m "fix(api): partner events/parcels require transporter_staff (403 like hotels)"
```

---

### Task 6: `docs/permissions.md` (slice-1 rows)

**Files:** Create `docs/permissions.md`.

- [ ] **Step 1: Write the file** with hierarchy + slice-1 matrix (traveler owner-scoped; transporter_staff affiliated-service-scoped; admin all; super_admin settings-only), one row per endpoint family touched in Tasks 1–5 plus pre-existing interurban rows (search, bookings, payments/refund, tickets, intraurban, me). Mark untouched families (hotels/rentals/events/parcels/insurance) as "Slice 2–6 — TBD by that slice". No TBDs inside slice-1 rows.

- [ ] **Step 2: Commit**

```bash
git add docs/permissions.md
git commit -m "docs: permission matrix slice 1 (interurban)"
```

---

### Task 7: Web role gate (UX, API stays authoritative)

**Files:** Modify `apps/web/middleware.ts`.

- [ ] **Step 1: Implement** — after the cookie check, decode the JWT payload WITHOUT verifying (routing hint only) and redirect mismatched roles:

```ts
function roleFromCookie(value: string): string | null {
  try {
    const payload = value.split(".")[1]
    if (!payload) return null
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: string }
    return typeof json.role === "string" ? json.role : null
  } catch {
    return null
  }
}
```

```ts
const role = roleFromCookie(cookie.value)
const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/")
const isTransporterArea = pathname === "/transporter" || pathname.startsWith("/transporter/")
if (isAdminArea && role !== "admin" && role !== "super_admin") {
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = "/admin/login"
  loginUrl.search = `?next=${encodeURIComponent(pathname)}`
  return NextResponse.redirect(loginUrl)
}
if (isTransporterArea && role !== "transporter_staff" && role !== "admin" && role !== "super_admin") {
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = "/login"
  loginUrl.search = `?next=${encodeURIComponent(pathname)}`
  return NextResponse.redirect(loginUrl)
}
```

Security note (add as comment above `roleFromCookie`): payload is unverified; a forged role only changes which login/area renders — every API call still enforces `requireAuth(role?)` server-side.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter ./apps/web exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat(web): role-aware UX redirects for admin/transporter areas"
```

---

### Task 8: Slice-1 validity fixes

**Files:**
- Modify: `apps/api/src/plugins/swagger.ts`, `packages/db/prisma/schema.prisma`, `apps/web/components/dashboard-v2/summary/SummaryGrid.tsx`, `apps/web/components/dashboard-v2/panels/DataTable.tsx`
- Create: `packages/db/prisma/migrations/20260922000001_refund_actor_fk/migration.sql`
- Delete: `apps/web/components/ui/modal.tsx`, `apps/web/components/ui/toast.tsx` (only if unused — verify first)

**Interfaces:** none.

- [ ] **Step 1: Verify modal/toast are unused**

Run: `rg -n "from [\"']@/components/ui/(modal|toast)[\"']|from [\"']\.\./ui/(modal|toast)[\"']" apps/web --type ts`
Expected: no output. If output appears, STOP — remove those two files from this task and note in commit message.

- [ ] **Step 2: Delete + swagger enum**

```bash
git rm apps/web/components/ui/modal.tsx apps/web/components/ui/toast.tsx
```

In `apps/api/src/plugins/swagger.ts` line 35, change `enum: ["email", "sms", "whatsapp", "push"]` to `enum: ["email", "whatsapp", "push"]`.

- [ ] **Step 3: Refund actor FK (source only)** — in `schema.prisma`, `model Refund`: change `actorId String?` block to:

```prisma
actorId         String?
actor           User?            @relation(fields: [actorId], references: [id], onDelete: SetNull)
```

Add `refunds         Refund[]` to `model User`. Create migration file `packages/db/prisma/migrations/20260922000001_refund_actor_fk/migration.sql`:

```sql
-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Refund_actorId_idx" ON "Refund"("actorId");
```

DO NOT run `prisma migrate deploy` or `db push` — per backend-patterns, applying schema changes to the connected DB needs explicit user confirmation. Note it in the commit message.

- [ ] **Step 4: SummaryGrid skeletons** — in `LoadingGrid`, change `xl:grid-cols-5` to `xl:grid-cols-6` and `length: 5` to `length: 6`.

- [ ] **Step 5: DataTable French labels** — replace the `StatusBadge` map values with accented French: `Confirmé`, `Annulé`, `Utilisé`, `Récupéré`, `Enregistré`, `Terminé`, `Payé`, `Échoué`, `Arrivé`, `Envoyé` (keep keys and variants unchanged; full StatusPill unification is slice 8).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter ./apps/web exec tsc --noEmit` and `pnpm --filter @camermove/api exec tsc --noEmit -p tsconfig.json`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/plugins/swagger.ts packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260922000001_refund_actor_fk apps/web/components/dashboard-v2/summary/SummaryGrid.tsx apps/web/components/dashboard-v2/panels/DataTable.tsx
git commit -m "fix(validity): drop dead ui files, sms enum, refund actor FK source (migrate pending confirm), fr labels"
```

(The `git rm` in Step 2 is already staged.)

---

### Task 9: Trips-tab cancel action (user dashboard)

**Files:** Modify `apps/web/components/dashboard-v2/tabs/DashboardTabs.tsx`.

**Interfaces:**
- Consumes: `CancelButton` (`{ visible, onCancel, invalidateKeys }`), `cancelBooking(id, token)` from `@/lib/api/bookings`.

- [ ] **Step 1: Implement** — import both, and in `renderPanel` append an action cell for the trips tab only. Replace the `DataTable` usage:

```tsx
import { CancelButton } from "../controls/CancelButton";
import { cancelBooking } from "@/lib/api/bookings";
```

```tsx
{tab === "trips" ? (
  <div className="flex flex-col gap-2">
    <DataTable columns={[...columns]} data={data.items} />
    <div className="flex flex-wrap gap-2">
      {data.items
        .filter((row) => ["pending_payment", "confirmed"].includes(String(row.status)))
        .slice(0, 3)
        .map((row) => (
          <CancelButton
            key={String(row.id)}
            visible
            onCancel={() => cancelBooking(String(row.id), token)}
            invalidateKeys={[["dashboard-trips"], ["dashboard-v2"]]}
          />
        ))}
    </div>
  </div>
) : (
  <DataTable columns={[...columns]} data={data.items} />
)}
```

Scope note: per-row buttons for the first 3 cancellable rows (keeps the generic table intact; full row-actions column is slice 8).

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter ./apps/web exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/dashboard-v2/tabs/DashboardTabs.tsx
git commit -m "feat(dashboard): cancel action for upcoming trips"
```

---

### Task 10: Smoke extensions for slice 1

**Files:** Modify `scripts/smoke/verticals.ts`.

- [ ] **Step 1: Append checks** inside `smokeVerticals` after the `profile.get` line:

```ts
const tripsRes = await fetch(`${BASE}/api/v1/trips?perPage=5`, { headers: h });
check("trips.list", tripsRes);
const tripsBody = (await tripsRes.json()) as { items: unknown[] };
if (!Array.isArray(tripsBody.items)) throw new Error("trips.list envelope missing items");

```ts
const revRes = await fetch(`${BASE}/api/v1/reviews/c000000000000000000000001`, { headers: h });
console.log(`  ${revRes.status === 404 ? "✓" : "✗"} reviews.missing-404 → ${revRes.status}`);
if (revRes.status !== 404) throw new Error(`reviews.missing-404 failed: ${revRes.status}`);

const trComm = await fetch(`${BASE}/api/v1/transporter/commissions`, { headers: h });
console.log(`  ${trComm.status === 403 ? "✓" : "✗"} transporter.commissions-traveler-403 → ${trComm.status}`);
if (trComm.status !== 403) throw new Error(`transporter.commissions guard failed: ${trComm.status}`);

const pEvents = await fetch(`${BASE}/api/v1/partner/events`, { headers: h });
console.log(`  ${pEvents.status === 403 ? "✓" : "✗"} partner.events-traveler-403 → ${pEvents.status}`);
if (pEvents.status !== 403) throw new Error(`partner.events guard failed: ${pEvents.status}`);
```

- [ ] **Step 2: Commit**

```bash
git add scripts/smoke/verticals.ts
git commit -m "test(smoke): slice-1 trips/reviews/commissions/guard checks"
```

(No live run here — smoke needs `docker compose up -d`; CI/slice-9 runs it. Typecheck the file: `pnpm --filter @camermove/api exec tsc --noEmit -p tsconfig.json` — scripts are covered by that project? If not covered, skip typecheck for this file and note it.)

---

## Self-Review

1. **Spec coverage:** §1 slice order — this plan is slice 1 only (interurban), remaining slices get their own plans. §1 per-slice components — hero/KPI/tasks/tables partially: tasks (cancel) Task 9, tables row-actions deferred to slice 8 with note. §2 CRUD — GET /trips (T1), transporter :id (T2), reviews (T3), commissions/bulk (T4), 403 unification (T5) all covered; partner DELETEs/parcel admin list/newsletter are later slices by design. §2 permissions doc (T6), web gate (T7) covered. §3 UI — cancel wiring (T9), skeletons/labels (T8); StatusPill unification + RateYourTrip + history scope deferred to slice 8 (noted). §3 validity — modal/toast/swagger/Refund FK (T8) covered; file splits/outbox/helmet/CI are slice 9. Verification gates in every task.
2. **Placeholders:** none — all code blocks complete; the single conditional (Task 8 Step 1 grep, Task 5 Step 3 test-update) has explicit instructions for both outcomes.
3. **Type consistency:** `getTransporterTrip(tripId, transporterId)` used identically in T2 steps 3–4; `listCommissions({page, limit, transporterId})` matches admin service signature; `deleteReview(id, user)` matches T3 route call; `CancelButton` props match its component signature; `cancelBooking(id, token)` matches lib signature.

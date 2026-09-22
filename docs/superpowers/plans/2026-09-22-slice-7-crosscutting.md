# Slice 7 — Cross-cutting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete cross-cutting features: contact/newsletter back-office, newsletter unsubscribe, notifications bulk-read + delete, wired favorites tab, permissions rows, smoke coverage. (Agencies/places/intraurban/landing stay read-only by design; reviews finished slice 1; no `DELETE /me` — documented decision.)

**Architecture:** Contact + newsletter already persist as `Notification` rows (`type` = `contact.submit` / `newsletter.subscribe`, `userId` null) — back-office reads filter by `type`, zero migration. Notifications writes follow `routes/me/notifications.ts` patterns.

**Tech Stack:** Fastify + Zod + Prisma, Next.js + react-query, vitest `buildApp().inject`, tsx smoke.

## Global Constraints

- AGENTS.md: stateless JWT, Zod `.parse()` in handlers, `req.meta` logs, `AuditLog` on admin writes, AppError subclasses only, French copy, no TODOs, typechecks clean, TDD red-green. Docker is UP (verify; real runs expected).

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/src/contact/routes.ts` | Add `GET /admin/contact` + export |
| `apps/api/src/newsletter/routes.ts` | Add `GET /admin/newsletter` + export + `DELETE /newsletter` |
| `apps/api/src/contact/contact-admin.test.ts` + newsletter test | New inject tests |
| `apps/api/src/routes/me/notifications.ts` | Add `PATCH /read-all` + `DELETE /:id` |
| `apps/api/src/routes/me/notifications-crud.test.ts` | New inject tests |
| `apps/web/components/dashboard-v2/tabs/tabStatic.tsx` | Wire FavoritesPanel to API |
| `apps/web/components/dashboard-v2/tabs/DashboardTabs.tsx` | Pass token to FavoritesPanel |
| `docs/permissions.md` | Append slice-7 section |
| `scripts/smoke/verticals.ts` | Cross-cutting checks |

---

### Task 1: Contact back-office (`GET /admin/contact` + export)

**Files:** Modify `apps/api/src/contact/routes.ts`; create `apps/api/src/contact/contact-admin.test.ts`.

- [ ] **Step 1: Test** (401/route-exists for both paths):

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

describe("contact back-office", () => {
  it("GET /admin/contact rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/contact" })
    expect(res.statusCode).toBe(401)
  })

  it("GET /admin/contact route exists", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/contact" })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })

  it("GET /admin/contact/export rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/contact/export?format=json" })
    expect(res.statusCode).toBe(401)
  })

  it("GET /admin/contact/export route exists", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/contact/export?format=json" })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** in `contact/routes.ts` (imports needed: `NotFoundError`? no — only admin guard + export helpers + prisma already imported; add `import { parseExportQuery, sendExport } from "../lib/export.js"` and use `(app as unknown as { requireAuth: (role?: string) => unknown }).requireAuth("admin")` matching file's cast style... the file currently uses none; check app.ts global admin hook? `admin/routes.ts:19` hook covers only that file. Contact routes are registered separately → per-route `requireAuth("admin")` like parcels `GET /admin/parcels/export`):

```ts
// GET /admin/contact — submissions are Notification rows (type contact.submit)
app.get("/admin/contact", { preHandler: (app as unknown as { requireAuth: (role?: string) => unknown }).requireAuth("admin") as never }, async (req) => {
  const query = req.query as Record<string, unknown>
  const user = (req as unknown as { user: { id: string; role: string } }).user
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
  const page = Math.max(1, Number(query.page ?? 1))
  const perPage = Math.min(50, Math.max(1, Number(query.perPage ?? 20)))
  req.log.info({ ...meta, actorId: user.id, page }, "admin.contact.list")
  const where = { type: "contact.submit" }
  const [items, total] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
    prisma.notification.count({ where }),
  ])
  return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) }
})

app.get("/admin/contact/export", { preHandler: (app as unknown as { requireAuth: (role?: string) => unknown }).requireAuth("admin") as never }, async (req, reply) => {
  const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
  const user = (req as unknown as { user: { id: string; role: string } }).user
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
  req.log.info({ ...meta, actorId: user.id, dateFrom, dateTo, format }, "admin.contact.export")
  const { loadEnv } = await import("@camermove/config")
  const env = loadEnv()
  const where: Record<string, unknown> = { type: "contact.submit" }
  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {}
    if (dateFrom) createdAt.gte = new Date(dateFrom)
    if (dateTo) createdAt.lte = new Date(`${dateTo}T23:59:59Z`)
    where.createdAt = createdAt
  }
  const rows = await prisma.notification.findMany({ where: where as never, take: env.SEARCH_MAX_LIMIT, orderBy: { createdAt: "desc" } })
  return sendExport(reply, "contact", dateFrom, dateTo, format, rows as unknown as Record<string, unknown>[], ["id", "createdAt"])
})
```

- [ ] **Step 4: Run — PASS** + typecheck; commit (`feat(api): contact back-office list + export`).

### Task 2: Newsletter back-office + unsubscribe

**Files:** Modify `apps/api/src/newsletter/routes.ts`; create `newsletter-admin.test.ts`.

- [ ] **Step 1: Test** — 401/route-exists for `GET /admin/newsletter`, `GET /admin/newsletter/export`; plus `DELETE /newsletter` without body → 400 (Zod) and unauthenticated DELETE with valid body → 401? DELETE is PUBLIC (unsubscribe link, no account needed): assert unauthenticated DELETE with `{ email: "nobody@x.cm" }` returns 200 `{ unsubscribed: false }`... wait — route doesn't exist yet so it 404s. Red test: expect 200 → FAIL pre-impl. Post-impl: 200. But careful: after impl, unknown email → 200 unsubscribed:false. Use that.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** — mirror Task 1 for `GET /admin/newsletter` + export with `type: "newsletter.subscribe"`, plus:

```ts
// DELETE /newsletter — public unsubscribe by email (link-safe, no auth)
app.delete("/newsletter", async (req) => {
  const body = NewsletterBody.parse((req as { body: unknown }).body)
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
  req.log.info({ ...meta, email: body.email }, "newsletter.unsubscribe")
  const existing = await prisma.notification.findFirst({
    where: { type: "newsletter.subscribe", payload: { path: ["email"], equals: body.email } },
    select: { id: true },
  })
  if (!existing) return { unsubscribed: false, email: body.email }
  await prisma.notification.delete({ where: { id: existing.id } })
  return { unsubscribed: true, email: body.email }
})
```

- [ ] **Step 4: PASS** + typecheck; commit (`feat(api): newsletter back-office + unsubscribe`).

### Task 3: Notifications bulk-read + delete

**Files:** Modify `apps/api/src/routes/me/notifications.ts`; create `notifications-crud.test.ts`.

- [ ] **Step 1: Test** — 401 for `PATCH /me/notifications/read-all` and `DELETE /me/notifications/:id` (cuid MISSING) + route-exists for both.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement:**

```ts
app.patch("/me/notifications/read-all", { preHandler: app.requireAuth() }, async (req) => {
  const user = (req as unknown as { user: { id: string } }).user
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
  req.log.info({ ...meta, userId: user.id }, "me.notifications.readAll")
  const rows = await prisma.notification.findMany({ where: { userId: user.id }, select: { id: true, payload: true } })
  let marked = 0
  for (const n of rows) {
    const payload = (n.payload ?? {}) as Record<string, unknown>
    if (payload.read === true) continue
    await prisma.notification.update({ where: { id: n.id }, data: { payload: { ...payload, read: true } as never } })
    marked += 1
  }
  return { marked }
})

app.delete("/me/notifications/:id", { preHandler: app.requireAuth() }, async (req) => {
  const { id } = IdParams.parse(req.params)
  const user = (req as unknown as { user: { id: string; role: string } }).user
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
  req.log.info({ ...meta, userId: user.id, notificationId: id }, "me.notifications.delete")
  const existing = await prisma.notification.findFirst({ where: { id, userId: user.id } })
  if (!existing) throw new NotFoundError("Notification introuvable")
  await prisma.notification.delete({ where: { id } })
  return { id, deleted: true }
})
```

Place BEFORE the existing `PATCH /:id/read` route (path safety, though no actual capture conflict). `IdParams`/`NotFoundError` already imported in the file (verify).
- [ ] **Step 4: PASS** + typecheck; commit (`feat(api): notifications bulk-read + delete`).

### Task 4: Wire favorites tab

**Files:** Modify `tabStatic.tsx`, `DashboardTabs.tsx`.

- [ ] **Step 1: `FavoritesPanel`** — accept `{ token }: { token: string }`, `useQuery(["dashboard-favorites", token, page])` via `fetchFavorites(token, { page, perPage: 20 })` from `@/lib/api/favorites`, page state, list with kind/entityId/date + `Retirer` button (`removeFavorite(token, id)` + `qc.invalidateQueries({ queryKey: ["dashboard-favorites"] })`), `PaginationControls`, skeletons + EmptyState fallback (keep existing empty copy/CTA when 0 items). Verify `PaginationControls` props (`page, totalPages, isFetching, onPageChange`) from its usage in DashboardTabs.
- [ ] **Step 2: `renderStaticPanel`** — pass token: `if (tab === "favorites") return <FavoritesPanel token={token} />`.
- [ ] **Step 3: Typecheck + commit** (`feat(dashboard): wired favorites tab`).

### Task 5: permissions.md slice-7 rows

Append before "## Later slices" (drop slice-7 item from roadmap):

```md
## Slice 7 — cross-cutting

| Endpoint | public | traveler | transporter_staff | admin / super_admin |
|---|---|---|---|---|
| `POST /contact`, `POST /newsletter`, `DELETE /newsletter` | allow (no auth; rate-limited) | allow | allow | allow |
| `GET /admin/contact`, `GET /admin/contact/export`, `GET /admin/newsletter`, `GET /admin/newsletter/export` | deny | deny | deny | allow |
| `GET /favorites`, `POST /favorites`, `DELETE /favorites/:id` | deny | own only | own only | own only (no admin override — personal list) |
| `GET /me/notifications`, `GET /me/notifications/export`, `PATCH /me/notifications/read-all`, `PATCH /me/notifications/:id/read`, `DELETE /me/notifications/:id` | deny | own only | own only | own only |
| `GET /agencies`, `GET /agencies/:slug`, `GET /places/autocomplete`, `GET /intraurban/*`, `GET /landing/*` | allow (read-only by design, no writes exist) | allow | allow | allow |
| `GET /me/profile`, `PATCH /me/profile` | deny | own only | own only | own only |

No `DELETE /me` (account closure) by design — destructive, needs product/policy decision first. No agency/place/intraurban writes (curated catalog data).
```

Verify the favorites-admin claim (no admin override — `removeFavorite({id, userId, role})` — check service allows admin? If admin CAN delete any, fix the cell to match reality — read service first). Commit `docs: permission matrix slice 7 (cross-cutting)`.

### Task 6: Smoke — cross-cutting

Append after slice-6 block:

```ts
const ctRes = await fetch(`${BASE}/api/v1/contact`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Smoke", email: "s@s.cm", message: "hello smoke cross-cutting slice" }),
});
console.log(`  ${ctRes.status === 201 ? "✓" : "✗"} contact.submit → ${ctRes.status}`);
if (ctRes.status !== 201) throw new Error(`contact.submit failed: ${ctRes.status}`);

const nlEmail = `smoke${Date.now()}@camermove.cm`;
const nl1 = await fetch(`${BASE}/api/v1/newsletter`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: nlEmail }) });
console.log(`  ${nl1.status === 201 ? "✓" : "✗"} newsletter.subscribe → ${nl1.status}`);
if (nl1.status !== 201) throw new Error(`newsletter.subscribe failed: ${nl1.status}`);
const nl2 = await fetch(`${BASE}/api/v1/newsletter`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: nlEmail }) });
console.log(`  ${nl2.status === 200 ? "✓" : "✗"} newsletter.replay-200 → ${nl2.status}`);
if (nl2.status !== 200) throw new Error(`newsletter replay failed: ${nl2.status}`);
const nlDel = await fetch(`${BASE}/api/v1/newsletter`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: nlEmail }) });
console.log(`  ${nlDel.status === 200 ? "✓" : "✗"} newsletter.unsubscribe → ${nlDel.status}`);
if (nlDel.status !== 200) throw new Error(`newsletter.unsubscribe failed: ${nlDel.status}`);

const favAdd = await fetch(`${BASE}/api/v1/favorites`, {
  method: "POST",
  headers: { ...h, "Content-Type": "application/json" },
  body: JSON.stringify({ kind: "hotel", entityId: "c000000000000000000000001" }),
});
console.log(`  ${[200, 201].includes(favAdd.status) ? "✓" : "✗"} favorites.add → ${favAdd.status}`);
if (![200, 201].includes(favAdd.status)) throw new Error(`favorites.add failed: ${favAdd.status}`);
const fav = (await favAdd.json()) as { id: string };
const favDel = await fetch(`${BASE}/api/v1/favorites/${fav.id}`, { method: "DELETE", headers: h });
console.log(`  ${favDel.status === 204 ? "✓" : "✗"} favorites.delete → ${favDel.status}`);
if (favDel.status !== 204) throw new Error(`favorites.delete failed: ${favDel.status}`);

const readAll = await fetch(`${BASE}/api/v1/me/notifications/read-all`, { method: "PATCH", headers: h });
console.log(`  ${readAll.status === 200 ? "✓" : "✗"} notifications.read-all → ${readAll.status}`);
if (readAll.status !== 200) throw new Error(`notifications.read-all failed: ${readAll.status}`);
```

First read `CreateFavoriteBody` in `apps/api/src/favorites/schema.ts` (confirm `kind` enum values + `entityId` format). If `kind: "hotel"` with a fake cuid fails FK validation, use a real hotel id discovered via `GET /api/v1/hotels?perPage=1` (add discovery + skip if none). Report which path was taken.

Commit `test(smoke): slice-7 cross-cutting`.

## Self-Review

1. **Spec coverage:** contact/newsletter back-office + unsubscribe (T1/T2), notifications bulk/delete (T3), favorites wiring (T4), perms (T5), smoke (T6). Agencies/places/intraurban/landing + DELETE /me documented as by-design.
2. **Placeholders:** none; T6 has read-and-adapt with fallbacks.
3. **Type consistency:** `removeFavorite({id, userId, role})` server-side; web `removeFavorite(token, id)` lib — distinct names, no clash.

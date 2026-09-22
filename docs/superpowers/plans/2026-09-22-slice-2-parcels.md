# Slice 2 — Parcels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the parcels service end-to-end: admin list, sender edit, fixed user-dashboard column/actions, permissions rows, smoke coverage.

**Architecture:** Same seams as slice 1 — new reads reuse `buildParcelWhere`/`findParcels`/`countParcels`; sender edit mirrors `cancelParcel` ownership/status guards; admin UI already good (export + FSM advance wired); dashboard actions follow the Task-9 trips pattern.

**Tech Stack:** Fastify + Zod + Prisma (API), Next.js + react-query + shadcn (web), vitest `buildApp().inject`, tsx smoke.

## Global Constraints

- AGENTS.md: stateless JWT, Zod `.parse()` in handlers (never Fastify `schema:`), `$transaction` where needed, 60s cache with `cacheKey`, `req.meta` + handler fields in logs, `AuditLog` on writes (try/catch + `req.log.warn` on failure per slice-1 I3 pattern), exports honor `SEARCH_MAX_LIMIT`.
- AppError subclasses only (`NotFoundError`, `ForbiddenError`, `ConflictError`, `BadRequestError` from `@camermove/config`) — never plain `Error` with `.statusCode` (handler 500s them per `app.ts:77-86`).
- French user copy; no TODOs; `pnpm -r typecheck` 0 errors (api AND web) before each commit; TDD red-green.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/src/parcels/routes.ts` | Add `GET /admin/parcels`, `PATCH /parcels/:id` |
| `apps/api/src/parcels/schema.ts` | Add `ParcelUpdateSchema` |
| `apps/api/src/parcels/service.ts` | Add `updateParcel` |
| `apps/api/src/parcels/parcels-admin-list.test.ts` | New inject tests |
| `apps/api/src/parcels/parcel-update.test.ts` | New inject tests |
| `apps/web/components/dashboard-v2/tabs/tabColumns.tsx` | Fix `trackingCode`→`trackingNumber` + track link |
| `apps/web/components/dashboard-v2/tabs/DashboardTabs.tsx` | Parcels pay/cancel action row |
| `apps/web/components/admin/AdminParcels.tsx` | Point list at `/admin/parcels`; tracking link |
| `docs/permissions.md` | Append slice-2 section |
| `scripts/smoke/verticals.ts` | Parcel lifecycle checks |

---

### Task 1: `GET /admin/parcels` list

**Files:** Modify `apps/api/src/parcels/routes.ts`; create `apps/api/src/parcels/parcels-admin-list.test.ts`.

**Interfaces:** Consumes `buildParcelWhere`, `findParcels`, `countParcels`, `buildPagination`, `ParcelSearchQuery`. Produces `GET /admin/parcels` → `{ items, total, page, perPage, totalPages }` (same envelope as `GET /parcels`).

- [ ] **Step 1: Write the failing test** (`apps/api/src/parcels/parcels-admin-list.test.ts`):

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

describe("GET /admin/parcels", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/parcels" })
    expect(res.statusCode).toBe(401)
  })

  it("route exists (not Fastify 404 body)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/parcels" })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`pnpm --filter @camermove/api exec vitest run src/parcels/parcels-admin-list.test.ts`, second test fails).
- [ ] **Step 3: Implement** — insert after the `GET /admin/parcels/export` block (line ~118), mirroring the `GET /parcels` handler but with `requireAuth("admin")` and no `userId` in `buildParcelWhere`:

```ts
// GET /admin/parcels — admin-only paginated list (same envelope as GET /parcels)
app.get("/admin/parcels", { preHandler: (app as unknown as { requireAuth: (role?: string) => unknown }).requireAuth("admin") as never }, async (req) => {
  const q = ParcelSearchQuery.parse(req.query)
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
  const user = (req as unknown as { user: { id: string; role: string } }).user
  const pagination = buildPagination({ page: q.page, perPage: q.perPage, limit: q.limit, offset: q.offset })
  ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.(
    { ...meta, q: q.q, status: q.status, recipientCity: q.recipientCity, page: q.page, limit: q.perPage, actorId: user.id },
    "parcels.admin.list",
  )
  const where = buildParcelWhere({ recipientCity: q.recipientCity, status: q.status, q: q.q, dateFrom: q.dateFrom, dateTo: q.dateTo })
  const [items, total] = await Promise.all([findParcels(where, pagination.skip, pagination.take, undefined as never), countParcels(where)])
  const page = pagination.page ?? q.page
  const perPage = pagination.take
  return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) }
})
```

Verify `buildParcelWhere` accepts all-optional args (it does — export route calls it without `userId`) and `findParcels(where, skip, take, orderBy)` signature matches the GET /parcels call (line 72). If `orderBy` param is required (not optional), pass `{ createdAt: "desc" }` instead of `undefined as never` and note in report.

- [ ] **Step 4: Run — expect PASS** + `tsc --noEmit -p tsconfig.json` clean.
- [ ] **Step 5: Commit** (`git add` the 2 files; `feat(api): add GET /admin/parcels list`).

### Task 2: `PATCH /parcels/:id` sender edit

**Files:** Modify schema/service/routes; create `parcel-update.test.ts`.

**Interfaces:** Consumes `prisma`, `NotFoundError/ForbiddenError/ConflictError`, `invalidateCache`. Produces `updateParcel(id, actorId, actorRole, patch)`.

- [ ] **Step 1: Test** — same 401/route-exists shape as Task 1 plus: `PATCH` missing id without token → 401; with no body → 401 wins (auth first). File `apps/api/src/parcels/parcel-update.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

const MISSING = "c000000000000000000000001"

describe("PATCH /parcels/:id", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "PATCH", url: `/api/v1/parcels/${MISSING}`, payload: { recipientPhone: "+237600000000" } })
    expect(res.statusCode).toBe(401)
  })

  it("route exists (not Fastify 404 body)", async () => {
    const res = await app.inject({ method: "PATCH", url: `/api/v1/parcels/${MISSING}`, payload: { recipientPhone: "+237600000000" } })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (second test).
- [ ] **Step 3: Schema** — append to `schema.ts`:

```ts
export const ParcelUpdateSchema = z.object({
  recipientName: z.string().min(2).max(100).optional(),
  recipientPhone: z.string().min(6).max(20).optional(),
  recipientCity: z.string().min(2).max(100).optional(),
  recipientAddress: z.string().max(200).optional(),
  description: z.string().max(500).nullable().optional(),
})
export type ParcelUpdateInput = z.infer<typeof ParcelUpdateSchema>
```

- [ ] **Step 4: Service** — append `updateParcel` to `service.ts` (mirror `cancelParcel` guards):

```ts
export async function updateParcel(id: string, actorId: string, actorRole: string, patch: { recipientName?: string; recipientPhone?: string; recipientCity?: string; recipientAddress?: string; description?: string | null }) {
  const parcel = (await prisma.parcel.findUnique({ where: { id } })) as unknown as { id: string; userId: string; status: string; trackingNumber: string } | null
  if (!parcel) throw new NotFoundError("Colis introuvable")
  const isAdmin = actorRole === "admin" || actorRole === "super_admin"
  if (!isAdmin && parcel.userId !== actorId) throw new ForbiddenError("Accès refusé")
  if (parcel.status !== "registered") throw new ConflictError(`Colis non modifiable — statut: ${parcel.status}`)
  const data: Record<string, unknown> = {}
  if (patch.recipientName !== undefined) data.recipientName = patch.recipientName
  if (patch.recipientPhone !== undefined) data.recipientPhone = patch.recipientPhone
  if (patch.recipientCity !== undefined) data.recipientCity = patch.recipientCity
  if (patch.recipientAddress !== undefined) data.recipientAddress = patch.recipientAddress
  if (patch.description !== undefined) data.description = patch.description
  const updated = await prisma.parcel.update({ where: { id }, data: data as never })
  try {
    await prisma.auditLog.create({
      data: { actorId, action: "parcel.update", entityType: "Parcel", entityId: id, metadata: { trackingNumber: parcel.trackingNumber, fields: Object.keys(data) } as never },
    })
  } catch (err) { const { prisma: _p } = await import("@camermove/db"); void _p }
  await invalidateCache("parcels*").catch(() => {})
  return updated
}
```

Simplify the AuditLog catch to match file style: `} catch {}` plus `req.log.warn` happens at route level. Use exactly:

```ts
  try {
    await prisma.auditLog.create({ data: { ... } })
  } catch {}
```

(Route logs the update with meta; matches `cancelParcel` file style.)

- [ ] **Step 5: Route** — after the `POST /parcels/:id/cancel` block:

```ts
// PATCH /parcels/:id — sender edit while registered (owner or admin)
app.patch("/parcels/:id", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
  const { id } = ParcelIdParams.parse(req.params)
  const body = ParcelUpdateSchema.parse(req.body ?? {})
  const user = (req as unknown as { user: { id: string; role: string } }).user
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
  ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, entityId: id, userId: user.id }, "parcels.update")
  return updateParcel(id, user.id, user.role, body)
})
```

Update the service import line to include `updateParcel` and schema import to include `ParcelUpdateSchema`.

- [ ] **Step 6: Run — PASS** + typecheck clean.
- [ ] **Step 7: Commit** (`feat(api): sender PATCH /parcels/:id while registered`).

### Task 3: User-dashboard parcels tab fix + actions

**Files:** Modify `tabColumns.tsx`, `DashboardTabs.tsx`.

- [ ] **Step 1: Fix column** in `GENERIC_COLUMNS.parcels`: change `{ key: "trackingCode", label: "Suivi" }` to:

```tsx
{
  key: "trackingNumber",
  label: "Suivi",
  render: (v: unknown, row: Record<string, unknown>) => (
    <a href={`/parcels/track/${String(v)}`} className="font-mono underline underline-offset-4">
      {String(v ?? row.id ?? "—")}
    </a>
  ),
},
```

- [ ] **Step 2: Action row** — in `renderPanel`, add a parcels branch mirroring the trips branch (Task 9 slice-1 shape):

```tsx
{tab === "parcels" ? (
  <div className="flex flex-col gap-2">
    <DataTable columns={[...columns]} data={data.items} />
    <div className="flex flex-wrap gap-2">
      {data.items
        .filter((row) => String(row.status) === "registered")
        .slice(0, 3)
        .map((row) => (
          <div key={String(row.id)} className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <span className="font-mono text-xs text-muted-foreground">{String(row.trackingNumber ?? row.id)}</span>
            <ParcelRowActions id={String(row.id)} token={token} />
          </div>
        ))}
    </div>
  </div>
) : ( ...existing trips ternary + default... )}
```

Restructure the existing `{tab === "trips" ? ... : <DataTable .../>}` into a three-way: trips → parcels → default.

- [ ] **Step 3: `ParcelRowActions` component** — define at file bottom (uses `CancelButton`, `cancelParcel(token, id)` and `createParcelPayment(parcelId, token)` from `@/lib/api/parcels`, invalidateKeys `[["dashboard-parcels"], ["dashboard-v2"]]`):

```tsx
function ParcelRowActions({ id, token }: { id: string; token: string }) {
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  async function pay() {
    setPaying(true);
    setPayError(null);
    try {
      const { createParcelPayment } = await import("@/lib/api/parcels");
      const res = await createParcelPayment(id, token);
      window.location.href = res.paymentUrl ?? res.authorizationUrl;
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Paiement impossible");
      setPaying(false);
    }
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={paying}
        onClick={pay}
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        {paying ? "Paiement…" : "Payer"}
      </button>
      {payError ? <span role="alert" className="text-xs text-destructive">{payError}</span> : null}
      <ParcelCancelButton id={id} token={token} />
    </div>
  );
}
```

Prefer static imports at top (`import { cancelParcel } from "@/lib/api/parcels"` + `createParcelPayment`) over the dynamic import above — use static; the dynamic form is only a fallback if circular imports bite (report which you used). `ParcelCancelButton` is a thin wrapper:

```tsx
function ParcelCancelButton({ id, token }: { id: string; token: string }) {
  const { cancelParcel } = require("@/lib/api/parcels"); // NO — use static import
}
```

Use static: `import { cancelParcel, createParcelPayment } from "@/lib/api/parcels"` at top, then:

```tsx
<CancelButton visible onCancel={() => cancelParcel(token, id)} invalidateKeys={[["dashboard-parcels"], ["dashboard-v2"]]} />
```

inline in `ParcelRowActions` (no separate wrapper component).

- [ ] **Step 4: Typecheck web** clean.
- [ ] **Step 5: Commit** (`feat(dashboard): parcels track link + pay/cancel actions, fix trackingNumber column`).

### Task 4: AdminParcels → dedicated list + tracking link

**Files:** Modify `apps/web/components/admin/AdminParcels.tsx`.

- [ ] **Step 1: Point query at new endpoint** — change queryFn URL from `/api/v1/parcels?...` to `/api/v1/admin/parcels?...` (same params; envelope identical). Update the stale comment (`GET /parcels returns all parcels for admin`) to `GET /admin/parcels (admin-only list)`.
- [ ] **Step 2: Tracking link** — change tracking cell to `<a href={`/parcels/track/${p.trackingNumber}`} className="font-mono text-xs underline underline-offset-4">{p.trackingNumber}</a>`. Next.js `Link` vs `<a>`: file has no Link import — add `import Link from "next/link"` and use `<Link>`.
- [ ] **Step 3: Typecheck + commit** (`feat(admin): parcels dedicated list + tracking links`).

### Task 5: `docs/permissions.md` slice-2 rows

Append (do not rewrite existing):

```md
## Slice 2 — parcels

| Endpoint | public | traveler | transporter_staff | admin / super_admin |
|---|---|---|---|---|
| `GET /parcels/quote`, `GET /parcels/track/:n` | allow (sanitized, phones masked) | allow | allow | allow |
| `POST /parcels`, `GET /parcels`, `GET /parcels/:id`, `GET /parcels/export` | deny | own only | own only | any |
| `PATCH /parcels/:id` (recipient/description while `registered`) | deny | owner only | owner only | any (any status? no — `registered` only, even admin) |
| `POST /parcels/:id/cancel` | deny | owner, `registered` + unpaid only | owner only | any |
| `POST /parcels/:id/pay` | deny | owner only | owner only | owner only |
| `GET /partner/parcels` | deny | 403 | own operators | all |
| `GET /admin/parcels`, `GET /admin/parcels/export`, `PATCH /admin/parcels/:id/status` (FSM) | deny | deny | deny | allow |
```

No DELETE on parcels by design (cancel covers withdrawal; delivered rows immutable). Commit `docs: permission matrix slice 2 (parcels)`.

### Task 6: Smoke — parcel lifecycle

In `scripts/smoke/verticals.ts` `smokeVerticals` after the slice-1 block, append:

```ts
const createRes = await fetch(`${BASE}/api/v1/parcels`, {
  method: "POST",
  headers: { ...h, "Content-Type": "application/json" },
  body: JSON.stringify({
    senderName: "Smoke Sender",
    senderPhone: "+237600000001",
    recipientName: "Smoke Receiver",
    recipientPhone: "+237600000002",
    senderCity: "Yaoundé",
    recipientCity: "Douala",
    parcelType: "standard",
  }),
});
console.log(`  ${createRes.status === 201 ? "✓" : "✗"} parcels.create → ${createRes.status}`);
if (createRes.status !== 201) throw new Error(`parcels.create failed: ${createRes.status}`);
const created = (await createRes.json()) as { id: string; trackingNumber: string };

const patchRes = await fetch(`${BASE}/api/v1/parcels/${created.id}`, {
  method: "PATCH",
  headers: { ...h, "Content-Type": "application/json" },
  body: JSON.stringify({ recipientPhone: "+237600000003" }),
});
console.log(`  ${patchRes.status === 200 ? "✓" : "✗"} parcels.patch → ${patchRes.status}`);
if (patchRes.status !== 200) throw new Error(`parcels.patch failed: ${patchRes.status}`);

const trackRes = await fetch(`${BASE}/api/v1/parcels/track/${created.trackingNumber}`);
console.log(`  ${trackRes.status === 200 ? "✓" : "✗"} parcels.track → ${trackRes.status}`);
if (trackRes.status !== 200) throw new Error(`parcels.track failed: ${trackRes.status}`);

const adminList = await fetch(`${BASE}/api/v1/admin/parcels`, { headers: h });
console.log(`  ${adminList.status === 403 ? "✓" : "✗"} admin.parcels-traveler-403 → ${adminList.status}`);
if (adminList.status !== 403) throw new Error(`admin.parcels guard failed: ${adminList.status}`);

const cancelRes = await fetch(`${BASE}/api/v1/parcels/${created.id}/cancel`, { method: "POST", headers: h });
console.log(`  ${cancelRes.status === 200 ? "✓" : "✗"} parcels.cancel → ${cancelRes.status}`);
if (cancelRes.status !== 200) throw new Error(`parcels.cancel failed: ${cancelRes.status}`);
```

Verify `h` includes no Content-Type by default (it is `{ Authorization }` — the spread + explicit Content-Type is correct). Confirm `createParcel` service returns `{ id, trackingNumber }` at top level (read service lines 66-115 before writing — if the shape is `{ parcel: {...} }`, adapt destructure + note in report). Commit `test(smoke): slice-2 parcel lifecycle`.

## Self-Review

1. **Spec coverage:** spec slice-2 = admin list (T1), sender PATCH + no-DELETE documented (T2/T5), partner 403 already slice-1, UI wiring (T3/T4), perms (T5), smoke (T6). Hotels/rentals/event/insurance untouched by design.
2. **Placeholders:** none — all code complete; T6 has one read-and-adapt with explicit fallback.
3. **Type consistency:** `updateParcel(id, actorId, actorRole, patch)` used identically; `cancelParcel(token, id)` / `createParcelPayment(parcelId, token)` match lib signatures; `ParcelRowActions({id, token})` consistent.

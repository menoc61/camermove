# Slice 4 — Rentals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the rentals service: partner delete, admin delete, dashboard pay/cancel actions, partner-UI deletes, permissions rows, smoke coverage. (AdminRentals list/export/moderation + datepicker already good — untouched; public list/detail/cancel/pay + partner CRUD + owner bookings endpoints already good — untouched.)

**Architecture:** Deletes follow the rentals file's existing inline-prisma + `auditLog.create().catch(()=>{})` pattern; active-booking guard = EXISTS `RentalBooking` with `status IN ('pending_payment','confirmed')` (terminal: `cancelled`/`expired` per kernel). No admin POST by design (partner-only creation, documented; admin moderates via `partnerStatus` PUT on `PUT /admin/rentals/:id`).

**Tech Stack:** Fastify + Zod + Prisma, Next.js + react-query + shadcn, vitest `buildApp().inject`, tsx smoke.

## Global Constraints

- AGENTS.md: stateless JWT, Zod `.parse()` in handlers (never Fastify `schema:`), `req.meta` logs, `AuditLog` on writes, AppError subclasses only (never plain Error + statusCode), French copy, no TODOs, typechecks clean, TDD red-green.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/src/rentals/routes.ts` | Add 1 DELETE |
| `apps/api/src/rentals/rental-delete.test.ts` | New inject tests (partner + admin DELETE) |
| `apps/api/src/admin/routes.ts` | Add 1 DELETE in admin rentals block |
| `apps/web/components/dashboard-v2/tabs/DashboardTabs.tsx` | Rentals pay/cancel action row |
| `apps/web/components/partner/RentalsPartnerClient.tsx` | Delete vehicle button |
| `apps/web/components/dashboard-v2/tabs/tabColumns.tsx` | Reconcile `vehicle.name` vs `vehicle.make/model` (see T3) |
| `docs/permissions.md` | Append slice-4 section |
| `scripts/smoke/verticals.ts` | Rentals checks |

---

### Task 1: `DELETE /partner/rentals/:id`

**Files:** Modify `apps/api/src/rentals/routes.ts`; create `apps/api/src/rentals/rental-delete.test.ts`.

- [ ] **Step 1: Test** (data-independent 401/route-exists):

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

const MISSING = "c000000000000000000000001"

describe("rental deletes", () => {
  it("DELETE /partner/rentals/:id rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/rentals/${MISSING}` })
    expect(res.statusCode).toBe(401)
  })

  it("DELETE /partner/rentals/:id route exists", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/rentals/${MISSING}` })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (test 2).
- [ ] **Step 3: Implement** — append after the `PUT /partner/rentals/:id` block (line ~225) in `apps/api/src/rentals/routes.ts`, following file patterns (`requireAuth()` preHandler cast, `req.user` via unknown cast, `req.params as { id: string }`, `NotFoundError("Véhicule introuvable")`, owner check, audit):

```ts
app.delete("/partner/rentals/:id", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user
  const { id } = req.params as { id: string }
  const existing = await prisma.rentalVehicle.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("Véhicule introuvable")
  if ((existing as unknown as { ownerId: string | null }).ownerId !== user.id && user.role !== "admin" && user.role !== "super_admin") throw new ForbiddenError("Accès refusé")
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
  const active = await prisma.rentalBooking.count({ where: { rentalVehicleId: id, status: { in: ["pending_payment", "confirmed"] } } as never })
  if (active > 0) throw new AppError(409, "CONFLICT", "Véhicule avec réservations actives — suppression impossible")
  await prisma.rentalVehicle.delete({ where: { id } })
  await prisma.auditLog.create({ data: { actorId: user.id, action: "partner.rental.delete", entityType: "RentalVehicle", entityId: id } }).catch(() => {})
  ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, entityId: id, userId: user.id }, "partner.rental.delete")
  return { id, deleted: true }
})
```

Verify `AppError(409, "CONFLICT", "…")` constructor is `(status, code, message)` — matches rentals usage at line 78 (`throw new AppError(400, "VALIDATION", "Dates invalides…")`). No Zod schema for `req.params` — partner routes use raw cast, matches `PUT` at line 217.

- [ ] **Step 4: Run — PASS** + typecheck clean.
- [ ] **Step 5: Commit** (`feat(api): partner rental delete with active-booking guard`).

### Task 2: `DELETE /admin/rentals/:id`

**Files:** Modify `apps/api/src/admin/routes.ts` (the rentals section ends at line ~413); extend `rental-delete.test.ts` with a new describe block (append, do not rewrite).

- [ ] **Step 1: Read** the admin rentals section — `PUT /admin/rentals/:id` at line 403. Mirror its `requireAuth` (already handled by the global `addHook("preHandler", app.requireAuth("admin"))` at line 19), `actor`/`meta` access pattern, dynamic `prisma: p` import, and `auditLog.create().catch(() => {})` style.
- [ ] **Step 2: Test** — append to `rental-delete.test.ts`:

```ts
describe("DELETE /admin/rentals/:id", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/admin/rentals/${MISSING}` })
    expect(res.statusCode).toBe(401)
  })

  it("route exists", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/admin/rentals/${MISSING}` })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})
```

(`MISSING` const already declared in T1 — do not redeclare.)

- [ ] **Step 3: Run — FAIL**, implement `DELETE /admin/rentals/:id` next to the other admin-rentals handlers (after `PUT /admin/rentals/:id`, before line 414's closing brace). Same active-booking 409 guard as T1, `p.rentalVehicle.delete`, `p.auditLog.create({ data: { actorId: actor.id, action: "admin.rental.delete", entityType: "RentalVehicle", entityId: id } }).catch(() => {})`, return `{ id, deleted: true }`. Log `req.log.info({ ...meta, actorId: actor.id, entityId: id }, "admin.rental.delete")`.
- [ ] **Step 4: Run — PASS** + typecheck; commit (`feat(api): admin rental delete with active-booking guard`).

### Task 3: Dashboard rentals pay/cancel actions

**Files:** Modify `DashboardTabs.tsx`, possibly `tabColumns.tsx`.

- [ ] **Step 1: Imports** — add `import { cancelRentalBooking, createRentalPayment } from "@/lib/api/rentals"` (signatures already verified: `cancelRentalBooking(token, id)` → `Promise<{ id, status }>`; `createRentalPayment(token, bookingId, { provider, method, phone, email })` → `Promise<{ payment, authorizationUrl, paymentUrl }>`).
- [ ] **Step 2: Reconcile `vehicle.name` discrepancy** — `apps/web/lib/api/rentals.ts:106` defines `MyRentalBookingItem.vehicle: { make, model, pickupCity }` (no `name`), but `apps/web/components/dashboard-v2/tabs/tabColumns.tsx:55-62` renders `vehicle.name` (`obj?.name ?? "—"`). Pick ONE:
  - (a) Update `MyRentalBookingItem.vehicle` to `{ name: string; make: string; model: string; pickupCity: string }` (add `name: \`${make} ${model}\`` on API response side OR keep API as-is and synthesize in the wrapper), OR
  - (b) Update the rentals column render to `obj?.make ? \`${obj.make} ${obj.model ?? ""}\`.trim() : "—"`.
  - Recommended: (b) — minimal change, no schema drift. **Confirm column behavior with a manual spot-check before committing.**
- [ ] **Step 3: Hotels→rentals branch** — extend the `renderPanel` conditional chain (currently `parcels → trips → hotels → default`) with a `rentals` branch BEFORE default, mirroring hotels: filter `String(row.status) === "pending_payment"`, slice 3, wrapper showing vehicle identity (use the same `(row.vehicle as { make?: string; model?: string })?.make ?? row.id` shape), plus a `RentalRowActions` component (pay via `createRentalPayment(token, id, { provider: "notchpay" })` → `paymentUrl ?? authorizationUrl` → `window.location.href` with the same missing-URL guard; cancel via `CancelButton` → `cancelRentalBooking(token, id)`, invalidateKeys `[["dashboard-rentals"], ["dashboard-v2"]]`).
- [ ] **Step 4: Typecheck + commit** (`feat(dashboard): rental pay/cancel actions`).

### Task 4: Partner-UI deletes

**Files:** Modify `RentalsPartnerClient.tsx`.

- [ ] **Step 1: Mutation** — add `deleteRental` (`DELETE /api/v1/partner/rentals/${id}`) via `apiFetch` + `useMutation`, invalidating `["partner-rentals"]`, toast `Véhicule supprimé`, error toast with server message (409 surfaces "réservations actives").
- [ ] **Step 2: Button** — per vehicle card: add a `Supprimer` button next to the existing `Badge` (with `window.confirm("Supprimer ce véhicule ?")` guard). Keep existing create + presign flows untouched.
- [ ] **Step 3: Typecheck + commit** (`feat(partner): rental delete`).

### Task 5: permissions.md slice-4 rows

Append a "Slice 4 — rentals" section to `docs/permissions.md` (before "## Later slices", drop "Slice 4 rentals" from the roadmap line). Match the slice-3 table shape (4-role columns, French copy):

```md
## Slice 4 — rentals

| Endpoint | public | traveler | transporter_staff | admin / super_admin |
|---|---|---|---|---|
| `GET /rentals`, `GET /rentals/:id` | allow | allow | allow | allow |
| `POST /rentals/bookings`, `GET /rentals/bookings/me`, `GET /rentals/bookings/export`, `GET /rentals/bookings/:id` | deny | own only | own only | any |
| `POST /rentals/bookings/:id/cancel`, `POST /rentals/bookings/:id/pay` | deny | owner only | owner only | owner only (cancel: any — kernel rule) |
| `GET /partner/rentals`, `POST /partner/rentals`, `PUT /partner/rentals/:id` | deny | 403 | own `ownerId` | any |
| `DELETE /partner/rentals/:id` | deny | 403 | owner, no `pending_payment`/`confirmed` bookings (409) | any scope, same 409 guard |
| `GET /admin/rentals`, `GET /admin/rentals/export`, `PUT /admin/rentals/:id`, `DELETE /admin/rentals/:id` | deny | deny | deny | allow (delete: same 409 guard) |

No `POST /admin/rentals` by design (partner-only creation; admin moderates via `partnerStatus`).
```

Verify kernel cancel rule (already verified in slice-3 T5): `apps/api/src/booking-kernel/cancel.ts:79-82` — `assertOwnedOrAdmin` allows `admin`/`super_admin` to cancel any. Commit `docs: permission matrix slice 4 (rentals)`.

### Task 6: Smoke — rentals

Append in `smokeVerticals` after slice-3 hotels block:

```ts
const rentalsRes = await fetch(`${BASE}/api/v1/rentals?perPage=5`, { headers: h });
check("rentals.list", rentalsRes);
const rentalsBody = (await rentalsRes.json()) as { items: Array<{ id: string }> };
if (!Array.isArray(rentalsBody.items)) throw new Error("rentals.list envelope missing items");
const withVehicle = rentalsBody.items[0];
if (withVehicle) {
  const rbRes = await fetch(`${BASE}/api/v1/rentals/bookings`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ rentalVehicleId: withVehicle.id, startDate: "2026-12-05", endDate: "2026-12-07", pickupCity: "Douala" }),
  });
  console.log(`  ${rbRes.status === 201 ? "✓" : "✗"} rentals.booking.create → ${rbRes.status}`);
  if (rbRes.status !== 201) throw new Error(`rentals.booking.create failed: ${rbRes.status} ${await rbRes.text()}`);
  const rb = (await rbRes.json()) as { id: string };
  const rbCancel = await fetch(`${BASE}/api/v1/rentals/bookings/${rb.id}/cancel`, { method: "POST", headers: h });
  console.log(`  ${rbCancel.status === 200 ? "✓" : "✗"} rentals.booking.cancel → ${rbCancel.status}`);
  if (rbCancel.status !== 200) throw new Error(`rentals.booking.cancel failed: ${rbCancel.status}`);
}

const pRentals = await fetch(`${BASE}/api/v1/partner/rentals`, { headers: h });
console.log(`  ${pRentals.status === 403 ? "✓" : "✗"} partner.rentals-traveler-403 → ${pRentals.status}`);
if (pRentals.status !== 403) throw new Error(`partner.rentals guard failed: ${pRentals.status}`);
```

Read `CreateRentalBookingBody` in `apps/api/src/rentals/schema.ts:17` — confirmed field names (`rentalVehicleId, startDate, endDate, pickupCity, dropoffCity?, pickupAddress?, dropoffAddress?, driverName?, driverPhone?`, dates `YYYY-MM-DD`). Adapt verbatim if the API rejects the minimal payload (e.g. require `dropoffCity`); fallback would be to add it. Top-level `id` confirmed via `reserve()` returning `ReserveResult`. Commit `test(smoke): slice-4 rentals`.

---

## Self-Review

1. **Spec coverage:** partner DELETE (T1), admin DELETE + no-POST documented (T2/T5), dashboard actions (T3, incl. column reconciliation), partner UI (T4), perms (T5), smoke (T6).
2. **Placeholders:** none; T3 has a read-and-decide step (column reconciliation (a) vs (b)) with explicit default; T6 has a read-and-adapt step for the smoke payload.
3. **Type consistency:** `cancelRentalBooking(token, id)` / `createRentalPayment(token, bookingId, opts)` match lib signatures; delete responses `{ id, deleted: true }` uniform.
4. **Differences vs slice-3:** rentals has no nested resource like `HotelRoom` — only one DELETE per scope, not two. Dashboard T3 needs the `vehicle.name` reconciliation (T3 step 2) — flag if going with (a) over (b).
5. **Deferred (not blocking):** `RentalsPanel.tsx` and `RentalVisualizer.tsx` are exported but unused in the dashboard render chain — out of scope; full row-actions column / `StatusPill` unification / history-scope still slice-8; file splits/outbox/helmet/CI still slice-9.

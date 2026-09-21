# Slice 3 — Hotels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the hotels service: partner deletes, admin delete, dashboard pay/cancel actions, partner-UI deletes, permissions rows, smoke coverage. (AdminHotels list/export/moderation + datepicker already good — untouched.)

**Architecture:** Deletes follow the file's existing inline-prisma + `auditLog.create().catch(()=>{})` pattern; active-booking guard = EXISTS `HotelBooking` with `status IN ('pending_payment','confirmed')` (terminal: `expired/cancelled/refunded` per `BookingStatus` enum). No admin POST by design (partner-only creation, documented).

**Tech Stack:** Fastify + Zod + Prisma, Next.js + react-query + shadcn, vitest `buildApp().inject`, tsx smoke.

## Global Constraints

- AGENTS.md: stateless JWT, Zod `.parse()` in handlers (never Fastify `schema:`), `req.meta` logs, `AuditLog` on writes, AppError subclasses only (never plain Error + statusCode), French copy, no TODOs, typechecks clean, TDD red-green.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/src/hotels/routes.ts` | Add 3 DELETEs |
| `apps/api/src/hotels/hotel-delete.test.ts` | New inject tests (all 3) |
| `apps/web/components/dashboard-v2/tabs/DashboardTabs.tsx` | Hotels pay/cancel action row |
| `apps/web/components/partner/HotelsPartnerClient.tsx` | Delete hotel + room buttons |
| `docs/permissions.md` | Append slice-3 section |
| `scripts/smoke/verticals.ts` | Hotel checks |

---

### Task 1: `DELETE /partner/hotels/:id` + `DELETE /partner/hotels/:id/rooms/:roomId`

**Files:** Modify `apps/api/src/hotels/routes.ts`; create `apps/api/src/hotels/hotel-delete.test.ts`.

- [ ] **Step 1: Test** (data-independent 401/route-exists for both routes):

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

const MISSING = "c000000000000000000000001"

describe("hotel deletes", () => {
  it("DELETE /partner/hotels/:id rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/hotels/${MISSING}` })
    expect(res.statusCode).toBe(401)
  })

  it("DELETE /partner/hotels/:id route exists", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/hotels/${MISSING}` })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })

  it("DELETE room rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/hotels/${MISSING}/rooms/${MISSING}` })
    expect(res.statusCode).toBe(401)
  })

  it("DELETE room route exists", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/hotels/${MISSING}/rooms/${MISSING}` })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (tests 2 + 4).
- [ ] **Step 3: Implement** — append after the `POST /partner/hotels/:id/rooms` block (line ~233), following file patterns (`req.user` via unknown cast is NOT used here — hotels file uses `(req as unknown as { user: ... }).user`; `req.params as { id: string }`; `NotFoundError("Hôtel introuvable")`; owner check `(existing as unknown as { ownerId: string | null }).ownerId !== user.id && role !== admin/super_admin → ForbiddenError("Accès refusé")`; audit pattern `prisma.auditLog.create({ data: { actorId: user.id, action: ..., entityType: ..., entityId: id } }).catch(() => {})`):

```ts
app.delete("/partner/hotels/:id", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user
  const { id } = req.params as { id: string }
  const existing = await prisma.hotel.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("Hôtel introuvable")
  if ((existing as unknown as { ownerId: string | null }).ownerId !== user.id && user.role !== "admin" && user.role !== "super_admin") throw new ForbiddenError("Accès refusé")
  const active = await prisma.hotelBooking.count({ where: { hotelId: id, status: { in: ["pending_payment", "confirmed"] } } as never })
  if (active > 0) throw new AppError(409, "CONFLICT", "Hôtel avec réservations actives — suppression impossible")
  await prisma.hotel.delete({ where: { id } })
  await prisma.auditLog.create({ data: { actorId: user.id, action: "partner.hotel.delete", entityType: "Hotel", entityId: id } }).catch(() => {})
  return { id, deleted: true }
})

app.delete("/partner/hotels/:id/rooms/:roomId", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user
  const { id, roomId } = req.params as { id: string; roomId: string }
  const hotel = await prisma.hotel.findUnique({ where: { id } })
  if (!hotel) throw new NotFoundError("Hôtel introuvable")
  if ((hotel as unknown as { ownerId: string | null }).ownerId !== user.id && user.role !== "admin" && user.role !== "super_admin") throw new ForbiddenError("Accès refusé")
  const room = await prisma.hotelRoom.findFirst({ where: { id: roomId, hotelId: id } })
  if (!room) throw new NotFoundError("Chambre introuvable")
  const active = await prisma.hotelBooking.count({ where: { roomTypeId: roomId, status: { in: ["pending_payment", "confirmed"] } } as never })
  if (active > 0) throw new AppError(409, "CONFLICT", "Chambre avec réservations actives — suppression impossible")
  await prisma.hotelRoom.delete({ where: { id: roomId } })
  await prisma.auditLog.create({ data: { actorId: user.id, action: "partner.hotel.room.delete", entityType: "HotelRoom", entityId: roomId } }).catch(() => {})
  return { id: roomId, deleted: true }
})
```

Verify `AppError` constructor `(status, code, message)` from existing usage (`new AppError(400, "VALIDATION", "Dates invalides")` line 81 — same file). Verify `HotelBookingParams`-style cuid validation: partner routes use raw `req.params` without Zod (see PUT block) — match that (no new schema).

- [ ] **Step 4: Run — PASS** + typecheck clean.
- [ ] **Step 5: Commit** (`feat(api): partner hotel + room deletes with active-booking guard`).

### Task 2: `DELETE /admin/hotels/:id`

**Files:** Modify `apps/api/src/admin/routes.ts` (find the hotels section — `PUT /admin/hotels/:id` exists; mirror it); extend `hotel-delete.test.ts`? No — separate small test addition in SAME file via new describe block (append, do not rewrite).

- [ ] **Step 1: Read** the admin hotels section (`rg -n "admin/hotels" apps/api/src/admin/routes.ts`) to copy guard/import style.
- [ ] **Step 2: Test** — append to `hotel-delete.test.ts`:

```ts
describe("DELETE /admin/hotels/:id", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/admin/hotels/${MISSING}` })
    expect(res.statusCode).toBe(401)
  })

  it("route exists", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/admin/hotels/${MISSING}` })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})
```

- [ ] **Step 3: Run — FAIL**, implement `DELETE /admin/hotels/:id` with `requireAuth("admin")` (match file's admin guard style — check whether the file uses a global preHandler hook or per-route guards; mirror exactly), same active-booking 409 guard, AuditLog `admin.hotel.delete`, return `{ id, deleted: true }`.
- [ ] **Step 4: Run — PASS** + typecheck; commit (`feat(api): admin hotel delete with active-booking guard`).

### Task 3: Dashboard hotels pay/cancel actions

**Files:** Modify `DashboardTabs.tsx`.

- [ ] **Step 1: Imports** — add `import { cancelHotelBooking, createHotelPayment } from "@/lib/api/hotels"` (signatures: `cancelHotelBooking(token, id)`, `createHotelPayment(token, bookingId, { provider: "notchpay" })` → `{ paymentUrl }`).
- [ ] **Step 2: Hotels branch** — extend the renderPanel conditional chain (now trips → parcels → default) with a hotels branch before default, mirroring parcels: filter `String(row.status) === "pending_payment"`, slice 3, wrapper with hotel name (`row.hotel` is an object `{name, city}` — render `String((row.hotel as {name?:string})?.name ?? row.id)`), plus a `HotelRowActions` component (pay via `createHotelPayment` → `window.location.href` with the same missing-URL guard as parcels; cancel via `CancelButton` → `cancelHotelBooking(token, id)`, invalidateKeys `[["dashboard-hotels"], ["dashboard-v2"]]`).
- [ ] **Step 3: Typecheck + commit** (`feat(dashboard): hotel pay/cancel actions`).

### Task 4: Partner-UI deletes

**Files:** Modify `HotelsPartnerClient.tsx`.

- [ ] **Step 1: Mutations** — add `deleteHotel` (`DELETE /api/v1/partner/hotels/${id}`) and `deleteRoom` (`DELETE /api/v1/partner/hotels/${hotelId}/rooms/${roomId}`) via `apiFetch` + `useMutation`, invalidating `["partner-hotels"]`, toasts `Hôtel supprimé` / `Chambre supprimée`, error toast with server message (409 surfaces "réservations actives").
- [ ] **Step 2: Buttons** — per hotel card: `Supprimer` (with `window.confirm("Supprimer cet hôtel ?")` guard); per room row: rooms currently shown as count only — expand to list rooms with per-room `Supprimer` (confirm). Keep existing create flows untouched.
- [ ] **Step 3: Typecheck + commit** (`feat(partner): hotel + room deletes`).

### Task 5: permissions.md slice-3 rows

Append:

```md
## Slice 3 — hotels

| Endpoint | public | traveler | transporter_staff | admin / super_admin |
|---|---|---|---|---|
| `GET /hotels`, `GET /hotels/:id` | allow | allow | allow | allow |
| `POST /hotels/bookings`, `GET /hotels/bookings/me`, `GET /hotels/bookings/export`, `GET /hotels/bookings/:id` | deny | own only | own only | any |
| `POST /hotels/bookings/:id/cancel`, `POST /hotels/bookings/:id/pay` | deny | owner only | owner only | owner only (cancel: any — kernel pending-only rule applies) |
| `GET /partner/hotels`, `POST /partner/hotels`, `PUT /partner/hotels/:id`, `POST /partner/hotels/:id/rooms` | deny | 403 | own `ownerId` | any |
| `DELETE /partner/hotels/:id`, `DELETE /partner/hotels/:id/rooms/:roomId` | deny | 403 | owner, no `pending_payment`/`confirmed` bookings (409) | any scope, same 409 guard |
| `GET /admin/hotels`, `GET /admin/hotels/export`, `PUT /admin/hotels/:id`, `DELETE /admin/hotels/:id` | deny | deny | deny | allow (delete: same 409 guard) |
```

Plus note: `No POST /admin/hotels by design (partner-only creation; admin moderates via partnerStatus).` Commit `docs: permission matrix slice 3 (hotels)`. Verify the cancel-any claim: kernel `cancel("hotel", ...)` owner-or-admin? Check `cancelHotelBooking(id, user.id, user.role)` passes role — kernel handles admin-any. If uncertain, write "owner or admin (kernel rule)".

### Task 6: Smoke — hotels

Append in `smokeVerticals` after slice-2 block:

```ts
const hotelsRes = await fetch(`${BASE}/api/v1/hotels?perPage=5`, { headers: h });
check("hotels.list", hotelsRes);
const hotelsBody = (await hotelsRes.json()) as { items: Array<{ id: string; rooms?: Array<{ id: string }> }> };
if (!Array.isArray(hotelsBody.items)) throw new Error("hotels.list envelope missing items");

const withRooms = hotelsBody.items.find((x) => Array.isArray(x.rooms) && x.rooms.length > 0);
if (!withRooms) {
  console.log("  ○ hotels.booking skipped — no hotel with rooms in seed");
} else {
  const roomId = withRooms.rooms![0]!.id;
  const hbRes = await fetch(`${BASE}/api/v1/hotels/bookings`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ hotelId: withRooms.id, roomTypeId: roomId, checkIn: "2026-12-01", checkOut: "2026-12-03", guests: 2 }),
  });
  console.log(`  ${hbRes.status === 201 ? "✓" : "✗"} hotels.booking.create → ${hbRes.status}`);
  if (hbRes.status !== 201) throw new Error(`hotels.booking.create failed: ${hbRes.status} ${await hbRes.text()}`);
  const hb = (await hbRes.json()) as { id: string };
  const hbCancel = await fetch(`${BASE}/api/v1/hotels/bookings/${hb.id}/cancel`, { method: "POST", headers: h });
  console.log(`  ${hbCancel.status === 200 ? "✓" : "✗"} hotels.booking.cancel → ${hbCancel.status}`);
  if (hbCancel.status !== 200) throw new Error(`hotels.booking.cancel failed: ${hbCancel.status}`);
}

const pHotels = await fetch(`${BASE}/api/v1/partner/hotels`, { headers: h });
console.log(`  ${pHotels.status === 403 ? "✓" : "✗"} partner.hotels-traveler-403 → ${pHotels.status}`);
if (pHotels.status !== 403) throw new Error(`partner.hotels guard failed: ${pHotels.status}`);
```

First read `CreateHotelBookingBody` in `apps/api/src/hotels/schema.ts` to confirm field names (`hotelId/roomTypeId/checkIn/checkOut/guests` + date format `YYYY-MM-DD`); adapt verbatim if different and note in report. Also confirm create response carries top-level `id` (else adapt). Commit `test(smoke): slice-3 hotels`.

## Self-Review

1. **Spec coverage:** partner DELETEs (T1), admin DELETE + no-POST documented (T2/T5), dashboard actions (T3), partner UI (T4), perms (T5), smoke (T6).
2. **Placeholders:** none; T2/T6 have read-and-adapt steps with explicit fallbacks.
3. **Type consistency:** `cancelHotelBooking(token, id)` / `createHotelPayment(token, bookingId, opts)` match lib; delete responses `{ id, deleted: true }` uniform.

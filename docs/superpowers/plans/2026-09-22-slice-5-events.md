# Slice 5 — Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the events service: organizer CRUD (event + categories), ticket-verify UI, dashboard pay/cancel actions, permissions rows, smoke coverage. (Admin events/bookings lists + exports already good — untouched.)

**Architecture:** Organizer mutations follow the hotels-partner file pattern (inline prisma + `auditLog.create().catch(()=>{})`, owner-or-admin checks, active-booking 409 guard on delete with `BookingStatus pending_payment/confirmed`). Verify UI consumes existing sanitized `POST /tickets/verify`.

**Tech Stack:** Fastify + Zod + Prisma, Next.js + react-query + shadcn, vitest `buildApp().inject`, tsx smoke.

## Global Constraints

- AGENTS.md: stateless JWT, Zod `.parse()` in handlers (never Fastify `schema:`), `req.meta` logs (ON the write paths — slice-3 lesson), `AuditLog` on writes, AppError subclasses only, French copy, no TODOs, typechecks clean, TDD red-green.
- Docker is DOWN in this environment: no vitest execution, no live smoke. Verification = typecheck + exact transcription + reviewer diff-read. State this in every report.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/api/src/events/routes.ts` | Add POST/PUT/DELETE partner events + POST category |
| `apps/api/src/events/event-manage.test.ts` | New inject tests |
| `apps/web/lib/api/events.ts` | Add `verifyTicket` helper |
| `apps/web/components/partner/VerifyTicketCard.tsx` | New verify form + result |
| `apps/web/app/partner/events/page.tsx` | Render verify card (read first) |
| `apps/web/components/dashboard-v2/tabs/DashboardTabs.tsx` | Events pay/cancel action row |
| `docs/permissions.md` | Append slice-5 section |
| `scripts/smoke/verticals.ts` | Events checks |

---

### Task 1: `POST /partner/events` organizer create

**Files:** Modify `apps/api/src/events/routes.ts`; create `apps/api/src/events/event-manage.test.ts`.

- [ ] **Step 1: Test** (401/route-exists):

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

const MISSING = "c000000000000000000000001"

describe("partner event management", () => {
  it("POST /partner/events rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/partner/events", payload: { name: "x" } })
    expect(res.statusCode).toBe(401)
  })

  it("POST /partner/events route exists", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/partner/events", payload: { name: "x" } })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (Docker down → buildApp ECONNREFUSED; record that outcome instead of red-green. If Docker is up, expect FAIL on test 2.)
- [ ] **Step 3: Implement** — append after the `GET /partner/events` block (line ~364), following file patterns (casted `requireAuth()`, unknown-cast user/meta, `?.info?.` logger):

```ts
const PartnerEventCreate = z.object({
  name: z.string().min(2).max(150),
  description: z.string().max(5000).optional(),
  eventType: z.enum(["concert", "sport", "conference", "festival", "theatre", "other"]),
  venue: z.string().min(2).max(200),
  city: z.string().min(2).max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  posterUrl: z.string().url().max(500).optional(),
})

app.post("/partner/events", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req, reply) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user
  if (user.role !== "transporter_staff" && user.role !== "admin" && user.role !== "super_admin") throw new ForbiddenError("Accès réservé aux partenaires")
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
  const body = PartnerEventCreate.parse(req.body)
  ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, userId: user.id, name: body.name }, "events.partner.create")
  const created = await prisma.event.create({
    data: { name: body.name, description: body.description, eventType: body.eventType, venue: body.venue, city: body.city, startDate: new Date(body.startDate), endDate: body.endDate ? new Date(body.endDate) : null, posterUrl: body.posterUrl, organizerId: user.id } as never,
  })
  await prisma.auditLog.create({ data: { actorId: user.id, action: "partner.event.create", entityType: "Event", entityId: created.id } }).catch(() => {})
  return reply.code(201).send(created)
})
```

(`z` imported line 2. `EventType` enum members verified: concert/sport/conference/festival/theatre/other. `status` defaults `on_sale`, `partnerStatus` defaults `pending` — omit both so moderation starts pending.)

- [ ] **Step 4: Typecheck** (`tsc --noEmit -p tsconfig.json`) clean. Attempt vitest run; record Docker-down outcome if it fails to connect.
- [ ] **Step 5: Commit** (`feat(api): partner event create`; stage 2 files).

### Task 2: PUT/DELETE event + POST category

**Files:** Modify routes + extend `event-manage.test.ts` (append describes, do not rewrite).

- [ ] **Step 1: Tests** — append:

```ts
describe("PUT /partner/events/:id", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "PUT", url: `/api/v1/partner/events/${MISSING}`, payload: { name: "y" } })
    expect(res.statusCode).toBe(401)
  })

  it("route exists", async () => {
    const res = await app.inject({ method: "PUT", url: `/api/v1/partner/events/${MISSING}`, payload: { name: "y" } })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})

describe("DELETE /partner/events/:id", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/events/${MISSING}` })
    expect(res.statusCode).toBe(401)
  })

  it("route exists", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/events/${MISSING}` })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})

describe("POST /partner/events/:id/categories", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "POST", url: `/api/v1/partner/events/${MISSING}/categories`, payload: { name: "VIP", price: 10000, quantity: 50 } })
    expect(res.statusCode).toBe(401)
  })

  it("route exists", async () => {
    const res = await app.inject({ method: "POST", url: `/api/v1/partner/events/${MISSING}/categories`, payload: { name: "VIP", price: 10000, quantity: 50 } })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})
```

- [ ] **Step 2: Run** (record Docker outcome).
- [ ] **Step 3: Implement** — after the POST block from Task 1:

```ts
app.put("/partner/events/:id", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user
  const { id } = EventIdParams.parse(req.params)
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
  const existing = await prisma.event.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("Événement introuvable")
  if ((existing as unknown as { organizerId: string | null }).organizerId !== user.id && user.role !== "admin" && user.role !== "super_admin") throw new ForbiddenError("Accès refusé")
  const body = PartnerEventCreate.partial().parse(req.body)
  ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, entityId: id, userId: user.id }, "events.partner.update")
  const updated = await prisma.event.update({ where: { id }, data: { ...body, startDate: body.startDate ? new Date(body.startDate) : undefined, endDate: body.endDate ? new Date(body.endDate) : undefined } as never })
  await prisma.auditLog.create({ data: { actorId: user.id, action: "partner.event.update", entityType: "Event", entityId: id } }).catch(() => {})
  return updated
})

app.delete("/partner/events/:id", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user
  const { id } = EventIdParams.parse(req.params)
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
  const existing = await prisma.event.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("Événement introuvable")
  if ((existing as unknown as { organizerId: string | null }).organizerId !== user.id && user.role !== "admin" && user.role !== "super_admin") throw new ForbiddenError("Accès refusé")
  const active = await prisma.eventBooking.count({ where: { eventId: id, status: { in: ["pending_payment", "confirmed"] } } as never })
  if (active > 0) throw new AppError(409, "CONFLICT", "Événement avec réservations actives — suppression impossible")
  ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, entityId: id, userId: user.id }, "events.partner.delete")
  await prisma.event.delete({ where: { id } })
  await prisma.auditLog.create({ data: { actorId: user.id, action: "partner.event.delete", entityType: "Event", entityId: id } }).catch(() => {})
  return { id, deleted: true }
})

const PartnerCategoryCreate = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  price: z.number().int().positive(),
  quantity: z.number().int().min(1).max(100000),
})

app.post("/partner/events/:id/categories", { preHandler: (app as unknown as { requireAuth: () => unknown }).requireAuth() as never }, async (req, reply) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user
  const { id } = EventIdParams.parse(req.params)
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
  const existing = await prisma.event.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("Événement introuvable")
  if ((existing as unknown as { organizerId: string | null }).organizerId !== user.id && user.role !== "admin" && user.role !== "super_admin") throw new ForbiddenError("Accès refusé")
  const body = PartnerCategoryCreate.parse(req.body)
  ;(req as unknown as { log: { info: (a: unknown, b: string) => void } }).log?.info?.({ ...meta, entityId: id, userId: user.id }, "events.partner.category.create")
  const created = await prisma.ticketCategory.create({ data: { eventId: id, name: body.name, description: body.description, price: body.price, quantity: body.quantity } as never })
  await prisma.auditLog.create({ data: { actorId: user.id, action: "partner.event.category.create", entityType: "TicketCategory", entityId: created.id } }).catch(() => {})
  return reply.code(201).send(created)
})
```

(`EventIdParams` imported line 6. `TicketCategory` fields verified: name/description/price/quantity (+currency default XAF, sold/held default 0, status default on_sale — omit).)

- [ ] **Step 4: Typecheck** clean; attempt vitest (record outcome). Commit (`feat(api): partner event update/delete + ticket categories`).

### Task 3: Ticket-verify UI

**Files:** Modify `apps/web/lib/api/events.ts`; create `apps/web/components/partner/VerifyTicketCard.tsx`; modify `apps/web/app/partner/events/page.tsx`.

- [ ] **Step 1: Read** `apps/web/app/partner/events/page.tsx` (find where `EventsPartnerClient` renders + token source).
- [ ] **Step 2: Helper** — append to `lib/api/events.ts`:

```ts
export interface TicketVerifyResult {
  kind: "event" | "trip"
  valid: boolean
  status: string
  label: string
  detail: string | null
  holder: string
  quantity: number
  category: string | null
}

export function verifyTicket(token: string, code: string): Promise<TicketVerifyResult> {
  return request<TicketVerifyResult>("/api/v1/tickets/verify", { method: "POST", token, body: { code } })
}
```

(Backend returns exactly these fields — `verifyCodeSanitized` lines 383-392/409-417. `detail` may be undefined on some paths → type `string | null` and coerce at render with `?? "—"`... keep type as above; if tsc complains the field can be missing, loosen to `detail?: string | null`.)

- [ ] **Step 3: Component** — create `VerifyTicketCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { verifyTicket, type TicketVerifyResult } from "@/lib/api/events";

export function VerifyTicketCard({ token }: { token: string }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<TicketVerifyResult | null>(null);
  const verify = useMutation({
    mutationFn: () => verifyTicket(token, code.trim()),
    onSuccess: (r) => setResult(r),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Contrôle des billets</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Code ou numéro de billet" value={code} onChange={(e) => setCode(e.target.value)} className="w-64" />
          <Button disabled={verify.isPending || !code.trim()} onClick={() => verify.mutate()}>
            {verify.isPending ? "Vérification…" : "Vérifier"}
          </Button>
        </div>
        {verify.isError && (
          <p role="alert" className="text-sm text-destructive">
            Billet introuvable ou invalide.
          </p>
        )}
        {result && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3">
            <Badge variant={result.valid ? "default" : "destructive"}>{result.valid ? "Valide" : "Invalide"}</Badge>
            <div>
              <p className="text-sm font-semibold">{result.label}</p>
              <p className="text-xs text-muted-foreground">{result.detail ?? "—"} · {result.holder} · ×{result.quantity}{result.category ? ` · ${result.category}` : ""}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Render** in `app/partner/events/page.tsx` above/below `EventsPartnerClient` (pass the same `token` prop the client receives).
- [ ] **Step 5: Typecheck web** clean; commit (`feat(partner): ticket verify card`).

### Task 4: Dashboard events pay/cancel actions

**Files:** Modify `DashboardTabs.tsx`.

- [ ] **Step 1: Imports** — add `import { cancelEventBooking, createEventBookingPayment } from "@/lib/api/events"` (signatures: `cancelEventBooking(token, id)`, `createEventBookingPayment(eventBookingId, token, provider?)` → `{ paymentUrl, authorizationUrl }`).
- [ ] **Step 2: Events branch** — extend the chain (rentals → … → default) with an events branch before default, mirroring rentals: filter `pending_payment`, slice 3, wrapper showing event title (`row.event` is an object — render `String((row.event as { name?: string })?.name ?? row.id)`), plus `EventRowActions` (pay via `createEventBookingPayment(id, token)` default provider + missing-URL guard; cancel via `CancelButton` → `cancelEventBooking(token, id)`, invalidateKeys `[["dashboard-events"], ["dashboard-v2"]]`).
- [ ] **Step 3: Typecheck + commit** (`feat(dashboard): event pay/cancel actions`).

### Task 5: permissions.md slice-5 rows

Append before "## Later slices" (and drop the slice-5 item from the roadmap line):

```md
## Slice 5 — events

| Endpoint | public | traveler | transporter_staff | admin / super_admin |
|---|---|---|---|---|
| `GET /events`, `GET /events/:id` | allow (approved + on_sale/limited only) | allow | allow | allow |
| `POST /events/bookings`, `GET /events/bookings/me`, `GET /events/bookings/export`, `GET /events/bookings/:id` | deny | own only | own only | any |
| `POST /events/bookings/:id/cancel`, `POST /events/bookings/:id/pay` | deny | owner only | owner only | owner only (cancel: any — kernel rule) |
| `POST /tickets/verify`, `GET /tickets/verify` | deny (auth required) | allow (sanitized view) | allow | allow |
| `GET /partner/events` | deny | 403 | own `organizerId` + KPIs | all |
| `POST /partner/events`, `PUT /partner/events/:id`, `POST /partner/events/:id/categories` | deny | 403 | owner (create: any staff; sets `organizerId`) | any |
| `DELETE /partner/events/:id` | deny | 403 | owner, no `pending_payment`/`confirmed` bookings (409) | any scope, same 409 guard |
| `GET /admin/events`, `GET /admin/events/export`, `GET /admin/event-bookings`, `GET /admin/event-bookings/export` | deny | deny | deny | allow |

No booking PUT/DELETE by design (cancel + pay cover the lifecycle; tickets immutable once issued).
```

Verify the 3 new endpoint families exist via `rg` before committing. Commit `docs: permission matrix slice 5 (events)`.

### Task 6: Smoke — events

Append in `smokeVerticals` after slice-4 block:

```ts
const eventsRes = await fetch(`${BASE}/api/v1/events?perPage=5`, { headers: h });
check("events.list", eventsRes);
const eventsBody = (await eventsRes.json()) as { items: Array<{ id: string; ticketCategories?: Array<{ id: string }> }> };
if (!Array.isArray(eventsBody.items)) throw new Error("events.list envelope missing items");

const withCat = eventsBody.items.find((x) => Array.isArray(x.ticketCategories) && x.ticketCategories.length > 0);
if (!withCat) {
  console.log("  ○ events.booking skipped — no event with categories in seed");
} else {
  const ebRes = await fetch(`${BASE}/api/v1/events/bookings`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ eventId: withCat.id, ticketCategoryId: withCat.ticketCategories![0]!.id, quantity: 1 }),
  });
  console.log(`  ${ebRes.status === 201 ? "✓" : "✗"} events.booking.create → ${ebRes.status}`);
  if (ebRes.status !== 201) throw new Error(`events.booking.create failed: ${ebRes.status} ${await ebRes.text()}`);
  const eb = (await ebRes.json()) as { id: string };
  const ebCancel = await fetch(`${BASE}/api/v1/events/bookings/${eb.id}/cancel`, { method: "POST", headers: h });
  console.log(`  ${ebCancel.status === 200 ? "✓" : "✗"} events.booking.cancel → ${ebCancel.status}`);
  if (ebCancel.status !== 200) throw new Error(`events.booking.cancel failed: ${ebCancel.status}`);
}

const pEvents = await fetch(`${BASE}/api/v1/partner/events`, { headers: h });
console.log(`  ${pEvents.status === 403 ? "✓" : "✗"} partner.events-traveler-403 → ${pEvents.status}`);
if (pEvents.status !== 403) throw new Error(`partner.events guard failed: ${pEvents.status}`);
```

First read `CreateEventBookingSchema` in `apps/api/src/events/schema.ts` to confirm `{ eventId, ticketCategoryId, quantity }` (+ date format if any); adapt verbatim if different. Commit `test(smoke): slice-5 events`.

## Self-Review

1. **Spec coverage:** organizer CRUD + categories (T1/T2), verify UI (T3), dashboard actions (T4), perms (T5), smoke (T6). Admin lists/exports untouched (already good).
2. **Placeholders:** none; T6 has read-and-adapt with fallback.
3. **Type consistency:** `cancelEventBooking(token, id)` / `createEventBookingPayment(id, token)` match lib; `verifyTicket(token, code)` new helper used by card.

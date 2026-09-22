# Slice 8 — Consoles Polish + Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish consoles (per-row actions, single status component, favorites UX) and harden (AppError consistency, happy-path tests, admin server-sort end-to-end, read-all efficiency).

**Architecture:** UI refactors stay inside dashboard-v2 + admin shared components; admin sort adds an allowlisted `sort=field.dir` param threaded routes→service→prisma; no schema changes.

**Tech Stack:** Next.js + react-query + shadcn; Fastify + Zod + Prisma; vitest (Docker UP — verify, real runs expected).

## Global Constraints

- AGENTS.md: Zod in handlers; `req.meta` logs; AuditLog on writes; AppError-only; French copy; no TODOs; typechecks clean; TDD. DashboardTabs must stay <250 lines; summary-tabs contract tests must stay green (they grep `TAB_PER_PAGE`, query keys, `PaginationControls`, legacy panel ExportButtons — keep all tokens).

---

## File Structure

| File | Responsibility |
|---|---|
| `tabs/DashboardTabs.tsx`, `tabs/rowActions.tsx`, `tabs/tabConfig.tsx` | Per-row actions (T1) |
| `cards/StatusPill.tsx`, `panels/DataTable.tsx` | Status unification (T2) |
| `tabs/tabStatic.tsx` | Favorites UX (T3) |
| `apps/api/src/reviews/service.ts`, `reviews/*test*`, `rentals/rental-delete.test.ts`, `events/event-manage.test.ts` | AppError + happy paths (T4) |
| `apps/api/src/admin/service.ts`, `apps/api/src/admin/routes.ts` (+ events/parcels/insurance admin lists) | orderBy backend (T5) |
| `apps/web/components/admin/shared.tsx` + 13 sections | Sortable headers (T6) |
| `apps/api/src/routes/me/notifications.ts` | updateMany read-all (T7) |

---

### Task 1: Per-row actions column

**Files:** Modify `DashboardTabs.tsx`, `rowActions.tsx`, `tabConfig.tsx`.

- [ ] **Step 1: Row action cell** — in `rowActions.tsx` add a generic `RowActionCell({ row, config, token })` that renders `{config.label(row)}` caption + `<config.Action id token>`. Export a `renderRowActions(config, token)` helper returning `(value, row) => <RowActionCell .../>` for use as a `Column.render`. Keep all existing exports (tests may import them... verify with rg; keep names stable regardless).
- [ ] **Step 2: tabConfig** — extend `TabActionConfig` with nothing new (label/Action/statuses suffice).
- [ ] **Step 3: DashboardTabs** — replace the detached first-3-buttons blocks with a per-row `actions` column: in `renderPanel`, when `action` exists, append `{ key: "__actions", label: "Actions", sortable: false, render: renderRowActions(action, token) }` to columns — but ONLY for rows matching `action.statuses`, otherwise render empty cell (helper handles: return null when status not included). Delete the detached `<div className="flex flex-wrap gap-2">` blocks. Keep `TAB_PER_PAGE`, query keys, `PaginationControls`, ExportButton, EmptyState, `?tab=` logic byte-identical in behavior.
- [ ] **Step 4: Verify** — web typecheck + `vitest run components/dashboard-v2` (51 must stay green, incl. <250-line contract). Commit (`feat(dashboard): per-row pay/cancel actions`).

### Task 2: StatusPill unification

**Files:** Modify `cards/StatusPill.tsx`, `panels/DataTable.tsx`.

- [ ] **Step 1: Extend StatusPill** — add `mapParcelStatus` (registered→pending "Enregistré", picked_up→confirmed? use sensible: picked_up "Pris en charge" confirmed-kind? keep kinds to the 5 existing: map picked_up/in_transit/arrived/available_for_pickup/delivered + hotel/rental/event/insurance generic words) — simplest correct: extend `StatusKind` with the labels needed and a `mapGenericStatus(status)` covering parcel + misc statuses with proper French labels, defaulting unknown → raw status text in outline Badge (never mislabel). Update `StatusPill` to use `mapGenericStatus` as final fallback instead of `mapBookingStatus` default-pending (which mislabels e.g. "delivered" parcel? currently delivered isn't mapped... `mapBookingStatus("delivered")` → default "pending" = WRONG label "En attente"). Keep `kind` prop + existing exports stable.
- [ ] **Step 2: DataTable** — replace local `StatusBadge` with `StatusPill` (`status={String(value)}`), delete the local component + map. Keep the `status` key convention.
- [ ] **Step 3: Verify** — web typecheck + dashboard-v2 vitest green. Commit (`feat(ui): single StatusPill, drop StatusBadge dup`).

### Task 3: Favorites UX robustness

**Files:** Modify `tabs/tabStatic.tsx`.

- [ ] **Step 1:** `Retirer` button: try/catch with per-row error text (`role="alert"`, "Retrait impossible"), `disabled` while pending (track pendingId state).
- [ ] **Step 2:** fetch error state: if `favs.isError` (and 0 items) render error Alert ("Impossible de charger les favoris.") instead of the empty state.
- [ ] **Step 3:** Typecheck + commit (`fix(dashboard): favorites error handling`).

### Task 4: AppError consistency + happy-path tests

**Files:** Modify `apps/api/src/reviews/service.ts`; extend `review-crud.test.ts` (or `reviews/*test*`), `rentals/rental-delete.test.ts`, `events/event-manage.test.ts`.

- [ ] **Step 1: Convert** the four `upsertReview` plain-`Error` + `.statusCode` throws to `BadRequestError`/`ForbiddenError` with byte-identical French messages (verify imports from `@camermove/config` exist; add if missing).
- [ ] **Step 2: Happy-path tests** (need seeded rows — read existing seed helpers in each test file first; mirror their style): reviews PUT + DELETE happy path (seed user+booking+trip? if too heavy, seed minimal via prisma like `trip-status.test.ts` does); rental DELETE 404 (missing id, authed traveler) + 403 (non-owner); event DELETE 404 + category POST 404. At minimum: 404-path tests for every new slice 1–5 endpoint that lacks them + one 403 owner test per delete endpoint. Concrete assertions only.
- [ ] **Step 3: Run suites** (`src/reviews src/rentals src/events src/transporter`) green + typecheck. Commit (`fix(api): AppError consistency + delete/guard happy paths`).

### Task 5: Admin orderBy backend

**Files:** Modify `apps/api/src/admin/service.ts`, `apps/api/src/admin/routes.ts`, plus admin lists in `events/routes.ts`, `parcels/routes.ts`, `insurance/routes.ts` (admin branches only).

- [ ] **Step 1: Helper** — in `admin/service.ts` (export for reuse):

```ts
export function parseAdminSort(
  raw: unknown,
  allowed: string[],
  def: Record<string, "asc" | "desc">,
): Record<string, "asc" | "desc"> {
  const s = typeof raw === "string" ? raw : ""
  const [field, dir] = s.split(".")
  if (field && allowed.includes(field)) return { [field]: dir === "desc" ? "desc" : "asc" }
  return def
}
```

- [ ] **Step 2: Thread** — each admin list function gains `sort?: unknown` param + `orderBy: parseAdminSort(params.sort, [<its sensible fields>], <its current hardcoded order>)`; each admin route passes its query's `sort` (no schema change needed if routes read `req.query` loosely — if they Zod-parse query with a strict object, extend the schema with `sort: z.string().optional()`). Cover: users, transporters, trips, bookings, payments, commissions, audit-logs, hotels, rentals (service.ts) + events, event-bookings, parcels, insurance (module files). Exports keep `createdAt desc` (stable exports — document in code comment).
- [ ] **Step 3: Tests** — extend one existing admin test file OR add `admin-sort.test.ts` asserting `?sort=email.asc` actually reorders (seed 2 users) + unknown field falls back to default. Run + typecheck. Commit (`feat(api): allowlisted orderBy on admin lists`).

### Task 6: Admin sortable headers UI

**Files:** Modify `apps/web/components/admin/shared.tsx` + all 13 section files.

- [ ] **Step 1: `SortableTh`** in `shared.tsx`:

```tsx
export function SortableTh({ label, field, sort, onSort }: { label: string; field: string; sort: string; onSort: (field: string) => void }) {
  const active = sort.startsWith(`${field}.`);
  const desc = sort === `${field}.desc`;
  return (
    <TableHead aria-sort={active ? (desc ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => onSort(field)} title={`Trier par ${label}`} className="inline-flex items-center gap-1 font-medium hover:text-foreground">
        {label}
        {active ? (desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />) : <ArrowUpDown className="size-3.5 opacity-40" />}
      </button>
    </TableHead>
  );
}
```

(Check `shared.tsx` imports TableHead + lucide icons; add only what's missing. Toggle logic in each section: `setSort(s => s === `${field}.asc` ? `${field}.desc` : `${field}.asc`)` + reset page to 1.)

- [ ] **Step 2: Wire every section** — each admin list gets `const [sort, setSort] = useState("<default matching server>")`, passes `sort` into query params, replaces 2–4 key `<TableHead>` with `<SortableTh>` (fields must be in that endpoint's allowlist from Task 5 — cross-check each). Sections: Users, Transporters, Trips, Bookings, Payments, Commissions, Hotels, Rentals, Parcels, Events, Insurance, AuditLog, (Settings: no table — skip).
- [ ] **Step 3: Typecheck + commit** (`feat(admin): sortable table headers`).

### Task 7: read-all updateMany

**Files:** Modify `apps/api/src/routes/me/notifications.ts`; extend `notifications-crud.test.ts`.

- [ ] **Step 1: Replace** the N+1 loop with:

```ts
const res = await prisma.notification.updateMany({ where: { userId: user.id }, data: { payload: ??? } })
```

Problem: `payload.read=true` merge can't be expressed in a single updateMany (JSON merge per-row differs). Correct approach: fetch ids needing update (payload->>'read' IS DISTINCT FROM 'true' via raw query?) — simplest correct: keep fetch, then `updateMany({ where: { id: { in: idsToMark } }, data: ... }` still needs per-row payload merge. Alternative: raw SQL `UPDATE "Notification" SET payload = payload || '{"read":true}'::jsonb WHERE "userId"=$1 AND (payload->>'read') IS DISTINCT FROM 'true'` via `prisma.$executeRaw`, returning count. Use `$executeRaw` with typed params (no string interpolation of user input — userId passed as parameter). Return `{ marked: count }`. Verify Prisma `$executeRaw` import/usage pattern in repo (grep; mirror).
- [ ] **Step 2: Tests** — extend crud test: seed 2 notifications (one read, one unread) → PATCH → `{ marked: 1 }` → second PATCH → `{ marked: 0 }`. Mirror existing seed style.
- [ ] **Step 3: Run + typecheck + commit** (`perf(api): single-query notifications read-all`).

## Self-Review

1. **Spec coverage:** row actions (T1), status single (T2), favorites (T3), AppError+tests (T4), admin sort backend+UI (T5/T6), read-all (T7).
2. **Placeholders:** none; T4/T5/T6 have read-and-mirror steps with exact anchors.
3. **Type consistency:** `SortableTh({label, field, sort, onSort})` uniform; `parseAdminSort` returns Prisma-compatible orderBy.

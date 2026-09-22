# Slice 6 — Insurance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the insurance service: dashboard pay/cancel actions, admin UI section, permissions rows, smoke coverage. No API changes — the API is complete (owner list/get/create/pay/cancel/export + admin list/export/get); no PUT/DELETE or partner CRUD by design (documented in perms).

**Architecture:** Dashboard actions mirror the parcels/events pattern; AdminInsurance mirrors AdminParcels structure (filters + export + table + pagination, no status mutation — none exists server-side).

**Tech Stack:** Next.js + react-query + shadcn (web mostly), Fastify untouched, vitest n/a (no API change), tsx smoke.

## Global Constraints

- French copy; no TODOs; web typecheck clean. Docker is UP (verify with `docker ps` — if down, typecheck-only + record).

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/web/components/dashboard-v2/tabs/DashboardTabs.tsx` | Insurance pay/cancel action row |
| `apps/web/components/admin/AdminInsurance.tsx` | New admin section |
| `apps/web/components/admin/AdminShell.tsx` | Wire "Assurances" nav + case |
| `docs/permissions.md` | Append slice-6 section |
| `scripts/smoke/verticals.ts` | Insurance checks |

---

### Task 1: Dashboard insurance pay/cancel actions

**Files:** Modify `DashboardTabs.tsx`.

- [ ] **Step 1: Imports** — add `import { cancelInsurancePolicy, createInsurancePayment } from "@/lib/api/insurance"` (signatures verified: `cancelInsurancePolicy(token: string, id: string)`, `createInsurancePayment(token: string, policyId: string, opts = {})` → `{ payment?, authorizationUrl?, paymentUrl? }`).
- [ ] **Step 2: Insurance branch** — extend the chain (...events → default) with an insurance branch before default: filter `pending_payment`, slice 3, wrapper showing policy number (`String(row.policyNumber ?? row.id)`), plus `InsuranceRowActions` (pay via `createInsurancePayment(token, id, {})` → `paymentUrl ?? authorizationUrl` + missing-URL guard; cancel via `CancelButton` → `cancelInsurancePolicy(token, id)`, invalidateKeys `[["dashboard-insurance"], ["dashboard-v2"]]`). Mirror `EventRowActions` exactly.
- [ ] **Step 3: Typecheck + commit** (`feat(dashboard): insurance pay/cancel actions`).

### Task 2: AdminInsurance section + shell wiring

**Files:** Create `apps/web/components/admin/AdminInsurance.tsx`; modify `AdminShell.tsx`.

- [ ] **Step 1: Component** — mirror `AdminParcels.tsx` structure (verified in-repo pattern):
  - Imports: `useState`, `useQuery/useQueryClient` (no mutation needed), `useAuthStore`, `apiFetch`, `Button`, `Badge`, `Skeleton`, `Alert/AlertDescription/AlertTitle`, `TriangleAlert`, `Download`, `toast` (sonner), `priceXaf` from `@camermove/shared`, shared `{ AdminDateRange, AdminEmptyRow, AdminFilterBar, AdminPagination, AdminSearch, AdminStatusSelect, AdminTableFrame }` from `./shared`.
  - State: `page, q, coverage ("": all | basic | standard | premium | family), dateFrom, dateTo`.
  - Query `["admin-insurance", params]` → `apiFetch("/api/v1/admin/insurance/policies?...", { method: "GET", token: token! })`, `enabled: !!token`. Item type: `{ id, policyNumber: string | null, destination, coverageType, travelersCount (note: API field is `travelers`? — VERIFY: EXPORT_COLUMNS lists `travelers`; lib `InsurancePolicy` interface field is `travelers: number`. Use `travelers`), premium, currency, status, startDate, endDate, createdAt }`. Check the actual API item shape before writing (read `buildInsuranceWhere`/`findPolicies` select or the service return — if the row field is `travelersCount`, use that; report which).
  - Coverage labels: `{ basic: "Basique", standard: "Standard", premium: "Premium", family: "Famille" }` (mirror lib `COVERAGE_LABELS`; do not import it — admin file is self-contained like others... actually importing from `@/lib/api/insurance` is fine too; simplest: local const).
  - Export buttons CSV/JSON → `/api/v1/admin/insurance/policies/export` with dateFrom/dateTo/q/coverage params (mirror AdminParcels `handleExport`, filename `export-insurance-YYYY-MM-DD.format`).
  - Table columns: Police | Destination | Couverture | Voyageurs | Prime | Statut | Période. Status badge: `active/valid → default`, else outline... check policy statuses first: read `cancelInsurancePolicy` + service for status values (`pending_payment`, `active`/`paid`?, `cancelled`?). Render `STATUS_LABELS[p.status] ?? p.status` with a small local map for known values; unknown → raw.
  - Skeletons (`h-32` cards like AdminParcels) + error Alert + empty row + `AdminPagination`.
- [ ] **Step 2: Shell wiring** — in `AdminShell.tsx`: add `import { AdminInsurance } from "./AdminInsurance"`, NAV entry `"Assurances"` after `"Événements"`, case `"Assurances": return <AdminInsurance />`.
- [ ] **Step 3: Typecheck + commit** (`feat(admin): insurance section`).

### Task 3: permissions.md slice-6 rows

Append before "## Later slices" (drop slice-6 from roadmap line):

```md
## Slice 6 — insurance

| Endpoint | public | traveler | transporter_staff | admin / super_admin |
|---|---|---|---|---|
| `GET /insurance/policies`, `GET /insurance/policies/:id`, `GET /insurance/policies/export` | deny | own only | own only | any (export multiplex) |
| `POST /insurance/policies` | deny | allow (own booking) | allow (own booking) | allow |
| `POST /insurance/policies/:id/pay`, `POST /insurance/policies/:id/cancel` | deny | owner only | owner only | owner only |
| `GET /admin/insurance/policies`, `GET /admin/insurance/policies/export`, `GET /admin/insurance/policies/:id` | deny | deny | deny | allow |

No PUT/DELETE by design (pay + cancel cover the lifecycle; policies immutable once issued). No partner CRUD (traveler product, no operator side).
```

Verify the traveler/admin export multiplex claim (`GET /insurance/policies/export` has isAdmin branch — routes.ts:69-71 confirmed). Commit `docs: permission matrix slice 6 (insurance)`.

### Task 4: Smoke — insurance

Append in `smokeVerticals` after slice-5 block:

```ts
const insList = await fetch(`${BASE}/api/v1/insurance/policies?perPage=5`, { headers: h });
check("insurance.list", insList);
const insBody = (await insList.json()) as { items: unknown[] };
if (!Array.isArray(insBody.items)) throw new Error("insurance.list envelope missing items");

const insCreate = await fetch(`${BASE}/api/v1/insurance/policies`, {
  method: "POST",
  headers: { ...h, "Content-Type": "application/json" },
  body: JSON.stringify({ destination: "France", startDate: "2026-12-01", endDate: "2026-12-10", travelersCount: 2, coverageType: "standard" }),
});
console.log(`  ${insCreate.status === 201 ? "✓" : "✗"} insurance.create → ${insCreate.status}`);
if (insCreate.status !== 201) throw new Error(`insurance.create failed: ${insCreate.status} ${await insCreate.text()}`);
const ins = (await insCreate.json()) as { id: string };
const insCancel = await fetch(`${BASE}/api/v1/insurance/policies/${ins.id}/cancel`, { method: "POST", headers: h });
console.log(`  ${insCancel.status === 200 ? "✓" : "✗"} insurance.cancel → ${insCancel.status}`);
if (insCancel.status !== 200) throw new Error(`insurance.cancel failed: ${insCancel.status}`);

const insAdmin = await fetch(`${BASE}/api/v1/admin/insurance/policies`, { headers: h });
console.log(`  ${insAdmin.status === 403 ? "✓" : "✗"} admin.insurance-traveler-403 → ${insAdmin.status}`);
if (insAdmin.status !== 403) throw new Error(`admin.insurance guard failed: ${insAdmin.status}`);
```

(CreatePolicyBody verified: `destination min 2, startDate/endDate YYYY-MM-DD regex, travelersCount 1..20, coverageType enum` — payload valid. Create response: confirm top-level `id` from `createPolicy` return before writing — read service lines 14-55; adapt if nested.)

Commit `test(smoke): slice-6 insurance`.

## Self-Review

1. **Spec coverage:** dashboard actions (T1), admin section (T2), perms (T3), smoke (T4). No API changes by design.
2. **Placeholders:** none; T2/T4 have read-and-confirm steps with fallbacks.
3. **Type consistency:** `cancelInsurancePolicy(token, id)` / `createInsurancePayment(token, policyId, {})` match lib; `InsuranceRowActions({id, token})` consistent.

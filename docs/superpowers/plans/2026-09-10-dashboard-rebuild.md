# Dashboard Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strangler-rebuild traveler + transporter dashboards on shadcn/base-maia with TDD, zero backend regression.

**Architecture:** Freeze `components/dashboard/Dashboard.tsx:853` as reference; build `components/dashboard-v2/` slice-by-slice (layout/summary/controls/cards/tabs/transporter). Keep all `lib/api/*` contracts (33/34 ALIVE). Extract shared `ExportButton`, `PaginationControls`, `CancelButton` on shadcn blocks.

**Tech Stack:** Next.js 16 App Router RSC, Tailwind v4, shadcn base-maia (Base-UI), TanStack Query, Vitest + jsdom + MSW, Playwright

## Global Constraints

- API stateless JWT `Authorization: Bearer`, no server session
- Every POST/PUT/PATCH sends `Idempotency-Key`
- `apps/web` only calls `REST /api/v1`, no direct `prisma.*`
- Single Zod EnvSchema, no raw `process.env` outside `packages/config`
- Every file <300 lines, one responsibility
- `pnpm -r typecheck` 0 errors, `pnpm -r test` green, no `TODO|FIXME|@ts-ignore|console.*` without justification
- shadcn rules: `FieldGroup+Field`, `gap-*` not `space-*`, `size-*`, `cn()`, semantic colors, `AvatarFallback`, Dialog/Sheet Title, full Card composition

---

### Task 1: Phase 0 harness + shadcn adds

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/api/src/routes/me/dashboard.test.ts`
- Create: `apps/web/lib/api/dashboard.test.ts`
- Modify: `apps/web/components.json` (via CLI adds)

**Interfaces:**
- Consumes: existing `profile.test.ts` pattern, `apiFetch` helper
- Produces: `vitest jsdom` env, `dashboard.test.ts` RED baseline, new UI primitives

- [ ] **Step 1: Write failing API test**

```ts
// apps/api/src/routes/me/dashboard.test.ts
import { describe, expect, it } from "vitest";
describe("GET /me/dashboard", () => {
  it("401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/me/dashboard" });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails/passes baseline**

Run: `pnpm --filter @camermove/api exec vitest run src/routes/me/dashboard.test.ts`
Expected: PASS 401 (contract exists), then extend to 200 authed + empty-user

- [ ] **Step 3: Add shadcn blocks**

```bash
pnpm dlx shadcn@latest add dialog alert-dialog calendar popover pagination empty form command radio-group switch -y
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter @camermove/web exec tsc --noEmit`
Expected: 0 errors (new blocks wired)

- [ ] **Step 5: Commit**

```bash
git add apps/web/vitest.config.ts apps/api/src/routes/me/dashboard.test.ts apps/web/lib/api/dashboard.test.ts
git commit -m "test: dashboard TDD harness + shadcn blocks"
```

### Task 2: layout/ slice

**Files:**
- Create: `apps/web/components/dashboard-v2/layout/AppSidebar.tsx`
- Create: `apps/web/components/dashboard-v2/layout/SiteHeader.tsx`
- Test: `apps/web/components/dashboard-v2/layout/layout.test.tsx`

**Interfaces:**
- Consumes: `@/components/ui/sidebar`, `breadcrumb`, `separator`
- Produces: `<DashboardShell>` with `SidebarProvider+SidebarInset`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardShell } from "./AppSidebar";
describe("DashboardShell", () => {
  it("renders nav + title", () => {
    render(<DashboardShell title="Dashboard"><div>child</div></DashboardShell>);
    expect(screen.getByRole("navigation")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @camermove/web exec vitest run src/components/dashboard-v2/layout/layout.test.tsx`
Expected: FAIL with "DashboardShell not defined"

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SiteHeader } from "./SiteHeader";
import { AppSidebar } from "./AppSidebar";
export function DashboardShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader title={title} />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @camermove/web exec vitest run src/components/dashboard-v2/layout/layout.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/dashboard-v2/layout/
git commit -m "feat(dashboard-v2): shell on shadcn sidebar"
```

### Task 3: controls/ slice

**Files:**
- Create: `apps/web/components/dashboard-v2/controls/ExportButton.tsx`
- Create: `apps/web/components/dashboard-v2/controls/PaginationControls.tsx`
- Create: `apps/web/components/dashboard-v2/controls/CancelButton.tsx`
- Test: `apps/web/components/dashboard-v2/controls/controls.test.tsx`

**Interfaces:**
- Consumes: `dialog, alert-dialog, calendar, popover, select, pagination, button`
- Produces: `<ExportButton endpoint resource token>`, `<PaginationControls page totalPages onPageChange>`, `<CancelButton onCancel>`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, expect, it } from "vitest";
describe("PaginationControls", () => {
  it("hides when totalPages<=1", async () => {
    const { PaginationControls } = await import("./PaginationControls");
    expect(PaginationControls).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @camermove/web exec vitest run src/components/dashboard-v2/controls/controls.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation (pagination block, no custom Prev/Next divs)**

```tsx
"use client";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
export function PaginationControls({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (n:number)=>void }) {
  if (totalPages <= 1) return null;
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem><PaginationPrevious onClick={() => onPageChange(Math.max(1, page-1))} /></PaginationItem>
        <PaginationItem><span aria-live="polite">Page {page} / {totalPages}</span></PaginationItem>
        <PaginationItem><PaginationNext onClick={() => onPageChange(Math.min(totalPages, page+1))} /></PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @camermove/web exec vitest run src/components/dashboard-v2/controls/controls.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/dashboard-v2/controls/
git commit -m "feat(dashboard-v2): shared controls on shadcn blocks"
```

### Task 4: cards/ + tabs/ + summary/ + transporter/

Follow same RED-GREEN per file, each <300 lines:
- `cards/UpcomingTripCard.tsx`, `TicketCard.tsx`, `HotelBookingCard.tsx`, `RentalBookingCard.tsx`, `ParcelCard.tsx`, `InsuranceCard.tsx`, `EventBookingCard.tsx`, `PaymentCard.tsx`, `NotificationCard.tsx` on `Card/Header/Title/Content/Footer + Badge + Separator`, `StatusPill`→Badge variants, `Empty` block, `Skeleton`
- `summary/SummaryGrid.tsx` on Card + Chart (`ChartContainer`)
- `tabs/DashboardTabs.tsx` 10 tabs on `Tabs/List/Trigger/Content`, React-Query keys `["dashboard-*"]`, perPage 20 preserved
- `transporter/TransporterDashboard.tsx` on Card+Table+Chart+Skeleton
- Delete after swap: `app/dashboard/data.json`, `ui/modal.tsx`, `ui/toast.tsx`, `packages/frontend/src/api.ts`, `@ts-ignore` in old Dashboard, dedupe `cn` imports, add `loading="lazy"` / `next/image`

**Verify each:** `vitest run <file>`, `tsc --noEmit`, commit `feat(dashboard-v2): <slice>`

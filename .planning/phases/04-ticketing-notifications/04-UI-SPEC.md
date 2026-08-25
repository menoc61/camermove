# Phase 4: Ticketing & Notifications — UI Design Contract

**Generated:** 2026-08-25
**Scope:** Traveler dashboard only (NOT the public ticket lookup — that's `GET /tickets/lookup?ref=` and renders a separate minimal page, not a design contract).
**Status:** Contract — locked decisions for the planner.

<domain>
## Visual Language (reuse, do not invent)

Match existing `apps/web` patterns:

- **Container:** `mx-auto max-w-md p-6` (mobile-first, single column)
- **Surface:** `rounded-2xl bg-white p-4 shadow-sm`
- **Brand color:** `text-[#0e9f8f]` / `bg-[#0e9f8f]` (teal)
- **Text:** `text-slate-500` (muted), `text-slate-400` (very muted), default slate-900
- **Status pills:** `rounded-full bg-{amber|red|emerald}-50 px-2 py-1 font-mono text-{color}-700`
- **CTA:** full-width `rounded-lg bg-[#0e9f8f] py-2 text-sm font-medium text-white disabled:opacity-50`
- **Language:** French copy (mirrors `recap.tsx` and home)
- **Auth pattern:** client component reads `accessToken` from `@camermove/frontend` zustand store; if missing, redirect to `/login?next=/dashboard`. API calls pass token via `lib/api/*.ts` helpers.

## Layout principles
- Single column on mobile (<768px), card stack
- Status badges always visible (color-coded)
- Empty states get a CTA to action (search home)
- Loading skeletons (3-bars) preferred over spinners for cards

## Non-goals for this contract
- No new color tokens, no new typography, no new spacing scale.
- No public ticket lookup UI styling (server-rendered minimal HTML; out of design scope).
- No notification preferences UI in v1 (always send 3 channels).
</domain>

<routes>
## Routes

### `/dashboard` — Traveler Dashboard (RSC)

**File:** `apps/web/app/dashboard/page.tsx` — marks `"use client"` because dashboard requires zustand token reads; split into:
- Wrapper RSC: `apps/web/app/dashboard/page.tsx` (server-fetches data via `lib/api/dashboard.ts`, passes JSON to client)
- Client view: `apps/web/components/dashboard/Dashboard.tsx` (renders cards, handles empty/loading/error states)

**Access:** JWT required. Server-side check: if no `accessToken` cookie/session, redirect to `/login?next=/dashboard`.

**Data source:** Single new API endpoint (added in Phase 4 plans):
- `GET /api/v1/me/dashboard` — returns `{ upcoming: Booking[], history: Booking[], tickets: Ticket[] }`
- Upcoming = bookings with `status=confirmed` AND `trip.departureAt > now`, ordered by `departureAt asc`, limit 20
- History = bookings with `status in (completed, cancelled)`, ordered by `trip.departureAt desc`, limit 20
- Tickets = `Ticket` rows joined with confirmed bookings, ordered by `createdAt desc`, limit 20
- Response shape:
  ```ts
  type DashboardResponse = {
    upcoming: Array<{
      bookingId: string; reference: string;
      trip: { id: string; origin: string; destination: string; departureAt: string; arrivalAt: string; vehicle: { plate: string; type: string } };
      seats: number; totalAmount: number; currency: "XAF";
      ticket: { id: string; verificationCode: string } | null;
    }>;
    history: Array<{ ...same shape, with status: 'completed' | 'cancelled' }>;
    tickets: Array<{ id: string; verificationCode: string; createdAt: string; booking: { reference: string; trip: { origin: string; destination: string; departureAt: string } } }>;
  }
  ```

**Sections (in order):**
1. **Header:** "Mes voyages" — single h1, brand teal, mb-4
2. **Upcoming trips:** card list (max 3 shown, "Voir tous" link if >3)
3. **Tickets:** card list (max 3 shown, "Voir tous" link if >3)
4. **History:** collapsed by default (toggle "Voir l'historique" / "Masquer l'historique"), card list

**Empty states:**
- Upcoming empty → "Aucun voyage à venir. Trouvez un trajet." with CTA button → `/`
- Tickets empty (no confirmed yet) → "Vos billets apparaîtront ici après paiement."
- History empty → hidden entirely (don't show section)

**Loading state:** 3 skeleton cards per visible section.
**Error state:** Single red banner "Impossible de charger vos voyages. Réessayez." with retry button.

### `/tickets/[id]` — Ticket Detail (RSC + client QR render)

**File:** `apps/web/app/tickets/[id]/page.tsx` (server entry; passes data to `TicketDetail` client component)

**Access:** JWT required + ticket must belong to current user (server-side enforced via `WHERE userId = $currentUserId`); 404 if not owned.

**Data source:** `GET /api/v1/me/tickets/:id` — returns full ticket record with QR PNG data-URL.

**Sections:**
1. **Header:** booking reference (`Réf. CM-XXXXXX`), status pill (confirmé/en attente), mb-4
2. **Trip info card:** origin → destination, departure + arrival datetimes (locale-fr formatted), vehicle plate, seat count
3. **QR card (centered):** white card with QR PNG `data:image/png;base64,...` rendered at 240×240, below it the verificationCode in monospace
4. **Passenger list:** compact rows of passenger fullName
5. **"Voir mes voyages"** back button → `/dashboard`

**Mobile:** QR card scales to viewport width with `max-w-[240px] mx-auto`.

**Empty/Error:**
- Not found → redirect `/dashboard` with toast "Billet introuvable"
- Already used → show grayed QR + "Billet utilisé le {scannedAt}"
</routes>

<components>
## Component Inventory (new files)

| File | Type | Props (TypeScript) | Mirrors |
|------|------|-------------------|---------|
| `apps/web/components/dashboard/Dashboard.tsx` | client | `{ data: DashboardResponse; onRetry: () => void }` | `apps/web/components/booking/recap.tsx` (token + API shape) |
| `apps/web/components/dashboard/UpcomingTripCard.tsx` | client | `{ booking: UpcomingItem; href: string }` | `apps/web/components/search/trip-card.tsx` |
| `apps/web/components/dashboard/TicketCard.tsx` | client | `{ ticket: TicketItem }` | new — compact ticket preview |
| `apps/web/components/dashboard/HistoryToggle.tsx` | client | `{ count: number; isOpen: boolean; onToggle: () => void }` | new |
| `apps/web/components/dashboard/SkeletonCard.tsx` | client | `{}` | new (3-bar skeleton) |
| `apps/web/components/dashboard/EmptyState.tsx` | client | `{ title: string; cta?: { label: string; href: string } }` | new |
| `apps/web/components/dashboard/StatusPill.tsx` | client | `{ status: 'confirmed'\|'pending'\|'cancelled'\|'completed' }` | new — color map: confirmed→emerald, pending→amber, cancelled→red, completed→slate |
| `apps/web/components/tickets/TicketDetail.tsx` | client | `{ ticket: TicketDetailResponse }` | new — centered QR + info cards |

**Modified files:**
- `apps/web/app/layout.tsx` — no change (layout already shared)
- `apps/web/lib/api/*` — add `dashboard.ts` and `tickets.ts` API helpers (mirrors `bookings.ts`)

**No new dependencies** — uses `qrcode` (backend) and `<img src="data:...">` (web). Native.
</components>

<acceptance>
## UI Acceptance Criteria (testable)

1. `/dashboard` server-side redirects to `/login?next=/dashboard` if `accessToken` missing in zustand store.
2. `/dashboard` renders 3 sections in order: Upcoming, Tickets, History.
3. Upcoming cards show: reference, origin→destination, departure datetime, totalAmount XAF, "Voir billet" link.
4. Ticket cards show: verificationCode, trip origin→destination, departure datetime, "Voir QR" link → `/tickets/[id]`.
5. Empty Upcoming shows CTA button to `/`.
6. History collapsed by default; toggle shows/hides with count badge.
7. Loading state shows 3 skeleton cards per visible section.
8. Error state shows red banner + retry button that re-fetches.
9. `/tickets/[id]` shows QR PNG at 240×240 (or viewport-width max), centered.
10. `/tickets/[id]` server returns 404 if ticket.userId ≠ currentUserId.
11. Status pill colors: confirmed=emerald, pending=amber, cancelled=red, completed=slate.
12. All copy in French.
13. Mobile: max-w-md container, single-column card stack, full-width QR on detail.
14. No horizontal scroll at 360px viewport width (smallest target).
</acceptance>

<planner_hints>
## Planner Notes (must respect)

- **Server vs client split:** `page.tsx` files are RSC wrappers; data is fetched server-side (token from cookie OR client-side via zustand and passed as initial). The simplest approach: client `Dashboard` component does the fetch with React Query (mirrors search patterns); `page.tsx` just gates on auth and renders `<Dashboard />`. Match Phase 2 booking recap's existing pattern.
- **QR display:** The backend generates QR as `data:image/png;base64,...` and stores it on `Ticket.qrDataUrl`. Frontend just `<img src={qrDataUrl} />`. No JS QR lib on frontend.
- **Reuse existing tokens:** No new colors, no new typography, no new components from a different lib.
- **AGENTS.md compliance:** Server pages still pass through RBAC middleware, metadata plugin, audit log on access for PII endpoints (`/api/v1/me/*`).

## Out of scope (do not design)
- Public `/tickets/lookup?ref=` page (server-rendered minimal, no design contract needed — handled in PLAN.md as a small server-rendered card).
- Notification preferences page (v2).
- Refund/reissue UI (admin/transporter-side, Phase 5).
</planner_hints>

---

*UI contract generated: 2026-08-25 — locked for Phase 4 planning*
</content>
</invoke>
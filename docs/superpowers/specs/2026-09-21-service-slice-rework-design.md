# Service-Slice Rework — CamerMove full-app review design

Date: 2026-09-21 · Branch: `feat/completion-pass` → `develop` · Status: approved §§1–3, awaiting spec review

## 0. Context and decisions

Full senior review (frontend, backend, DevOps, security) of 33 features across
`apps/api, worker, web` + `packages/*`. Evidence from five read-only audits
(CRUD, RBAC, dead-code/logic, dashboards, DevOps/security). User decisions:

- Rework strategy: **C. service slices** — one service at a time across
  API + UI + smoke (not dashboards-first horizontal, not backend-first).
- **Slice 1 = interurban transport** (trips/search/bookings/payments/tickets +
  transporter trips/vehicles/routes + intraurban). It is the launch service and
  must be fully functional first; then parcels → hotels → rentals → events →
  insurance → cross-cutting → consoles polish → arch upgrades.
- Roles canonical: **4 DB roles** — `traveler` (owner-scoped subscriber of one
  or more services), `transporter_staff` (partner console, data scoped by
  affiliated service), `admin` (sub-role of `super_admin`), `super_admin`
  (only role for `/admin/settings`). No separate `partner` role; fix every
  doc/UI string saying `role === "transporter"` or `"partner"`.
- Cleanup: **aggressive** — delete confirmed dead code, split files >300
  lines, keep one-refund-per-payment (`Refund.paymentId @unique`), CinetPay
  refunds stay explicit not-implemented.

## 1. Slice order and per-slice main components

Each slice ships: API CRUD fill + RBAC row + UI hero/KPI/tasks/tables wiring +
smoke + dead-code removal in touched files + `docs/permissions.md` row.

1. **Interurban launch** — trips/search/bookings/payments/refunds/tickets,
   transporter console (profile/vehicles/routes/trips/bookings/stats),
   intraurban lines/schedule/search, reviews on trips.
2. **Parcels** — quote/track/cancel/pay, admin status, partner list, exports.
3. **Hotels** — catalog + partner CRUD + bookings/cancel/pay + exports.
4. **Rentals** — same shape as hotels.
5. **Events** — catalog + partner list + bookings/cancel/pay + ticket verify UI.
6. **Insurance** — policies/pay/cancel + admin list/export.
7. **Cross-cutting** — reviews (PUT/DELETE), favorites, agencies, places,
   contact/newsletter admin lists + unsubscribe, landing, `me`
   profile/notifications (bulk-read/delete).
8. **Consoles polish** — user → transporter → admin to the dashboard contract
   in §3.
9. **Arch upgrades** — helmet, transactional outbox, CI, infra healthchecks,
   idempotency-key fix, `AuditLog(entityType, entityId)` index, city-label
   cardinality guard, Turbo `globalEnv`.

Main dashboard components (every console): **hero** (next/today item + primary
CTA), **KPI grid** (icon + value + delta + click-through), **tasks / action
required** (pay + `holdExpiresAt` countdown, rate trip, verify tickets, review
applications, mark commission paid), **tables** (row actions, datepicker,
bulk, `?tab=&page=` deep-link, single `StatusPill`).

## 2. CRUD completion (deltas only; cancel-flows stay, no PUT on immutable)

- Slice 1: add `GET /trips` public list (filters/sort/page, cached 60s,
  `search_requests_total`); `GET /transporter/trips/:id`; wire
  `updateTrip`/status in transporter Trips UI; fix `bulkCreateTrips` (admin-only
  `{ids[], action}` — either scope to transporter or remove from transporter
  lib); fix `listCommissions` (add transporter-scoped commissions endpoint or
  delete the call); `PUT/PATCH + DELETE /reviews/:id`, `GET /reviews/:id`.
- Parcels: add `GET /admin/parcels` list (export exists); decide
  `PUT /parcels/:id` vs status-only (keep cancel/status, document why no
  generic PUT).
- Hotels/rentals: add `DELETE /partner/hotels|:id`, `DELETE room`,
  `DELETE /partner/rentals/:id`; add `POST/DELETE /admin/hotels|rentals`
  or document transporter-only creation.
- Events: add `POST /events`, `PUT/DELETE /events/:id`,
  `POST /partner/events` (organizer flow) or document admin-only creation.
- Insurance: keep pay/cancel-only (document no generic PUT/DELETE).
- Partner applications: add `PUT` (resubmit), `DELETE` (withdraw), `GET /:id`.
- Newsletter: add `DELETE` (unsubscribe) + `GET /admin/newsletter` + export.
  Contact: add `GET /admin/contact` + export.
- Notifications: add bulk-read + `DELETE /me/notifications/:id`.
- Transporter bookings stay read-only (document: traveler cancels, admin
  refunds).

## 3. Permission matrix (to be written to `docs/permissions.md`)

`requireAuth(role?)` hierarchy `traveler(0) < transporter_staff(1) < admin(2) <
super_admin(3)`. Owner-scoping: traveler by `userId`; transporter_staff by
affiliated service (`transporterId` for trips, `ownerId`/`organizerId` for
partner entities — unify to one canonical key per slice, default
`transporterId` resolution via `resolveTransporter`, creator-`ownerId` only
where solo operators are intended); admin sees all; super_admin alone for
settings. Fixes: `GET /partner/events` + `GET /partner/parcels` return `[]`
to travelers — change to 403 like hotels/rentals; `POST|GET /tickets/verify`
confirm staff-only vs public intent; single prefix hook or test asserting every
`/admin/` route requires admin rank; web `middleware.ts` role gate (token-only
today — traveler JWT renders transporter pages then 403s).

## 4. Validity — dead code and logic fixes

Delete: `apps/web/components/ui/modal.tsx`, `ui/toast.tsx`, 16 legacy
`dashboard-v2/panels/*Panel.tsx` + `*Visualizer.tsx` (unwired, generic
`DataTable` is canonical), `StatusBadge` duplicate (keep `StatusPill`), fix
`SummaryGrid` 5-col/6-card bug, `#billing` anchor, `#bookings` dead link,
`?tab=`-ignoring sidebar active state. Split files >300 lines starting with
`agencies.ts` (786), `sidebar.tsx` (729), `payments/service.ts` (494),
`admin/service.ts` (473), `events/routes.ts` (419), `admin/routes.ts` (400).
Add shared `calcTotal(price, seatCount)`; move worker `process.env` reads to
`loadEnv()`; remove `sms` from the swagger channel enum until an SMS provider
exists (dispatcher and `channels/` only implement email/whatsapp/push);
`Refund.actorId` → `User` FK; `AuditLog.create` on register/login (hashed
email + ip/os/browser); replace `actorId: "system"` + silent `.catch(()=>{})`
audit writes with lookup + log/metric; `invalidateCache("search*")` on trip
writes + `invalidateCache("dashboard:*")` on booking confirm/cancel.

## 5. Verification per slice

Each slice gets its own implementation plan and PR (this spec decomposes into
9 slice plans — slice 1 first). Per slice: `pnpm -r typecheck` 0 errors; `pnpm -r test` incl. last-seat concurrency +
idempotency replay; `pnpm smoke` (auth/search/tickets/dashboard/verticals/
exports) against `docker compose up -d`; `rg "TODO|FIXME|dead|unused"` clean;
`docs/permissions.md` row + OpenAPI `/docs` updated; PR per slice to
`develop` with feature-by-feature commits.

## 6. Risks

CinetPay refunds remain unavailable (explicit throw — surface in UI);
single-refund-per-payment blocks partial/multiple refunds by design;
transactional outbox is the largest backend change — ship as its own slice
with relay + fallback; web role gate changes may redirect bookmarked pages.

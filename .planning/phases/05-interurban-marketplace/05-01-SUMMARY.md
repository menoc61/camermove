# 05-01 Summary — Full-Functionality Repair (interurban marketplace + ecosystem)

## Verification evidence (final state)

| Gate | Result |
|---|---|
| `pnpm -r typecheck` | ✅ 0 errors (all 10 packages) |
| `pnpm -r test` | ✅ all pass — apps/api 10 files / 31 tests (concurrent last-seat, idempotent replay, expire-holds, reconciliation), packages 7 suites |
| `pnpm smoke` (auth + search) | ✅ register/login/me; search Yaoundé→Douala 14 items incl. multi-agency; trip detail ok |
| `pnpm smoke:tickets` | ✅ full booking→payment→ticket→24h-reminder loop; 1 reminder row per channel (email/whatsapp/push) |
| `pnpm smoke:dashboard` | ✅ dashboard 200 with {upcoming,history,tickets}; unauth 401; non-owner ticket 404 (no leak); public lookup ok |
| Mojibake scan (`Ã|â€|ÔÇ|Â…`) | ✅ TOTAL: 0 across apps/web, apps/api, packages |
| Prohibited colors `#0e9f8f` / `#f4b607` | ✅ CLEAN |
| Prohibited layout transitions (width/height/top/left/box-shadow) | ✅ CLEAN (sidebar `transition-[width]` removed) |
| TODO/FIXME scan | ✅ 0 hits |
| `prisma migrate deploy` | ✅ 7 migrations applied, no pending |

## Fixes applied (by bug ID from the spec)

**P0 — correctness**
- **BUG-1** Search agency filter: `transporterId` threaded into `findSearchableTrips`/`countSearchableTrips` + Redis cache key + web `fetchSearch`/`SearchParams`; logged in route metadata.
- **BUG-2** `seed.ts` infinite self-recursion removed (single top-level `main()`).
- **BUG-3** Urban seed: `urban@camermove.cm` transporter, 5 Yaoundé lines (both directions), flat 450/500 XAF, departures every 30 min 05:30–22:00 for today+3d → 1020 urban trips (probe-verified, not duplicated).
- **BUG-4/16** All double-encoded French strings decoded (powerful-search-bar cities, results page, trips detail, dashboard, partner, admin…). Scanner reports 0.
- **BUG-5** `AdminSettings`: `useState(() => setForm())` crash replaced by proper `useEffect` sync (form no longer `undefined`).
- **BUG-6** Admin money ÷100 errors removed (Dashboard/Trips/Bookings/Payments/Commissions) — XAF integers displayed directly.

**P1 — logic/consistency**
- **BUG-7** `dateTo` end-of-day (`T23:59:59Z`) applied in advanced search, payments list/export, transporter payments.
- **BUG-8** Advanced search `orderBy` whitelisted (price/departureAt/durationEstimate/totalSeats/createdAt, asc|desc).
- **BUG-9** Admin “Paramètres” nav gated to `super_admin` (README already documents `super@camermove.cm`).
- **BUG-10** Per-transporter `commissionPercent` editor in AdminTransporters; `computeCommission` prefers the DB column; settings `featureFlags` retyped `record<string, boolean>` (fixes Prisma JSON input type error).
- **BUG-11** `smtpPass` added to settings schema + form.
- **BUG-12** Book page rebuilt: live seats (`useLiveSeats`), `max = min(10, seatsAvailable)` via Stepper, `{n} disponibles` badge, `SeatUrgency`, clamp+toast when inventory shrinks, “Trajet complet” card, Recap `blocked` prop; dynamic hold text (`Hold 5 min` < 1000 XAF else 15).
- **BUG-13** Multi-agency UI: `agency-chips.tsx` (Toutes + per-agency, URL state, page reset), monochrome `trip-card.tsx` (agency dot • name, VIP border pill, urgency, bold price, black CTA, transform-only hover with `::after` opacity), urban `Passager N` prefill on the book page.
- **BUG-14** Transporter presign aligned to `{ objectKey, uploadUrl }` + `uploadTransporterDocument` helper (browser→MinIO PUT).
- **BUG-15** `expire-holds` integration test green (paid-unconfirmed holds survive).

**P2 — hygiene**
- Dead exports removed: `packages/frontend/src/theme.ts` (teal), `api.ts`; barrel updated. 0 TODO/FIXME.
- `sidebar.tsx` `transition-[width]` removed (prohibition gate now empty).
- Scratch/tmp artifacts deleted; working tree contains only intentional changes.

## Verified working end-to-end loops

- **Traveler**: auth (incl. Google callback, `cm_access` cookie) → search (filters, agency chips, live seats) → trip detail → book (stepper clamped to live inventory, hold countdown) → booking (idempotent) → payment → ticket (QR) → dashboard → public lookup. Backed by smoke:tickets + smoke:dashboard.
- **Intraurban**: `/intraurban` lines + schedule (1020 seeded departures, validUntil = departure+2h) → standard booking flow with 5-min hold + `Passager N` prefill.
- **Transporter**: stats, profile, vehicles, routes, trips (single+bulk), bookings, payments, commissions, presign upload.
- **Admin**: stats, users, transporters (+ commission %), partner review, trips, bookings, payments, commissions, audit, settings (super_admin, smtpPass), exports with datepickers.

## Runbook

```bash
docker compose up -d            # infra
pnpm --filter @camermove/db exec prisma migrate deploy
pnpm db:seed                    # idempotent (multi-agency + urban + demo users)
pnpm dev                        # api :3000 · web :3001 · worker
pnpm smoke && pnpm smoke:tickets && pnpm smoke:dashboard
```

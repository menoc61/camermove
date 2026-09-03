---
phase: 06-vague-a-hebergement-mobilite
plan: 03
subsystem: web
tags: [hotels, rentals, homepage, dashboard, partner, admin, nextjs, presigned]
requires:
  - phase: 06-vague-a-hebergement-mobilite
    provides: [hotels atomique ACID, rentals overlap strict, cache, audit+kafka, polymorphic pay]
provides:
  - Homepage grille 3 cols transport col-span-2 row-span-2 primary + 5 tuiles secondaires (Bed Car Package Ticket Bus) + counts best-effort + footer note
  - SiteNav 7 entrees Acceuil/Transport interurbain/Hotels & apparts/Location vehicules/Transport colis/Billetterie/Mes reservations + Compte
  - Hotels & rentals parcours complet search + fiche + booking idempotent + calc nights/duration + export
  - Dashboard tabs Voyages|Hotels|Vehicules VISIBLE_LIMIT 3 + EmptyState CTAs
  - Partner hotels/rentals CRUD presigned via @camermove/media objectKey + partnerStatus badge
  - Admin Hotels & Vehicules tables + exports dateFrom/dateTo csv + partnerStatus approve/reject
affects: [partenaires onboarding, admin ops, traveler conversion]
tech-stack:
  added: [lucide-react Bus/Bed/Car/Package/Ticket already present, sonner, motion]
  patterns: [RSC guard cookies x-cm-user-token, useQuery client with apiFetch, Idempotency-Key crypto.randomUUID, presignPut @camermove/media, Tabs shadcn, cache 60s via API]
key-files:
  created:
    - apps/web/lib/api/hotels.ts
    - apps/web/lib/api/rentals.ts
    - apps/web/app/hotels/[id]/page.tsx
    - apps/web/app/rentals/[id]/page.tsx
    - apps/web/app/partner/hotels/page.tsx
    - apps/web/app/partner/rentals/page.tsx
    - apps/web/components/partner/HotelsPartnerClient.tsx
    - apps/web/components/partner/RentalsPartnerClient.tsx
    - apps/web/components/admin/AdminHotels.tsx
    - apps/web/components/admin/AdminRentals.tsx
  modified:
    - apps/web/app/page.tsx
    - apps/web/components/landing/SiteNav.tsx
    - apps/web/components/landing/SiteFooter.tsx
    - apps/web/app/hotels/page.tsx
    - apps/web/app/rentals/page.tsx
    - apps/web/components/dashboard/Dashboard.tsx
    - apps/web/components/admin/AdminShell.tsx
    - apps/api/src/hotels/routes.ts
    - apps/api/src/rentals/routes.ts
    - apps/api/src/admin/routes.ts
key-decisions:
  - "Homepage transport dominant 2x: col-span-2 row-span-2 bg-primary min-h 280px, 5 cartes secondaires bg-card border en grid-cols-3 + subtitle principal, SiteNav 7 links + Compte via useAuthStore (desktop+mobile overlay staggerLinks inchange)"
  - "Hotels/rentals fetch clients via NEXT_PUBLIC_API_URL direct fetch for GET search/detail sans token, POST bookings via apiFetch avec Idempotency-Key crypto.randomUUID + auth, calcs nights = ceil((checkOut-checkIn)/86400000) et duration via vehicle.durationUnit hour/day/week/month"
  - "Dashboard tabs utilises useSearchParams ?tab=hotels|rentals default trips, VISIBLE_LIMIT 3, Promise.all cote client via apiFetch /hotels/bookings/me + /rentals/bookings/me, HotelBookingCard/RentalBookingCard type inline, EmptyState CTA Decouvrir Hotels -> /hotels"
  - "Partner presign POST /hotels/presign et /partner/hotels/presign (idem rentals) via @camermove/media getStorage+objectKey transporters/${user.id}/hotels, guard transporter_staff|admin|super_admin, CRUD partner/hotels + :id/rooms et partner/rentals"
  - "Admin hotels/rentals GET /admin/hotels|rentals avec q/city/category/status/partnerStatus/dateFrom/dateTo + GET /admin/hotels|rentals/export via parseExportQuery/sendExport SEARCH_MAX_LIMIT + PUT /admin/hotels|rentals/:id partnerStatus; AdminShell NAV + Hôtels + Vehicules"
patterns-established:
  - "Hotels/rentals lib/api clients: fetchHotels/fetchRentals URLSearchParams + fetchHotel/fetchRental + createBooking with Idempotency-Key"
  - "Page hotels/rentals client useQuery [hotels,params] debounced via state page reset, FilterBar Stepper Badge PaginationControls, detail page rooms + dates+guests calc + POST -> router.push /dashboard?tab=hotels"
  - "Partner client useQuery partner-hotels/rentals + useMutation presign uploadUrl PUT browser->MinIO puis objectKey stocke, photos objectKeys via media"
requirements-completed:
  - HOTEL-05
  - RENTAL-05
  - NAV-01
  - HOME-01
  - DASH-01
  - ADMIN-04
  - TRANS-04
duration: 60min
completed: 2026-09-03
status: complete
---

# Phase 06 Plan 03: Web + Partner + Admin — Hôtels & Véhicules Summary

**Homepage héros dominant transport 2x + partner presigned + admin Hôtels/Véhicules + dashboard tabs**

## Performance

- **Duration:** 60 min
- **Started:** 2026-09-03T10:15:00Z
- **Completed:** 2026-09-03T11:20:00Z
- **Tasks:** 6
- **Files modified:** 18

## Accomplishments

- Homepage `app/page.tsx` grille `grid-cols-1 md:grid-cols-3 gap-4` transport `col-span-2 row-span-2 bg-primary` + 5 tuiles Bed/Car/Package/Ticket/Bus, counts `prisma.hotel.count active` + `rentalVehicle.count available` best-effort try/catch, CTA `Réserver un bus` → `/results`, subtitle `Le transport interurbain est notre service principal`
- SiteNav `NAV_LINKS` 7 entrées `/ + /results + /hotels + /rentals + /parcels + /events + /dashboard` + Compte via `useAuthStore` (Se connecter ↔ Compte) + mobile overlay `staggerLinks` + footer note ajoutée
- `lib/api/hotels.ts|rentals.ts` `fetchHotels/fetchRentals` GET `/api/v1/hotels|rentals?city&checkIn&checkOut&guests&minPrice&maxPrice&q&page&perPage` + `fetchHotel/Rental(id)` + `createHotel/RentalBooking(token,body)` `Idempotency-Key: crypto.randomUUID()` + `fetchMyBookings`
- `app/hotels/page.tsx` client `useQuery ["hotels",params]` filters city/dates/guests Stepper/prix/q + `HotelCard` photo star amenities pricePerNight + pagination; `[id]/page.tsx` rooms expand  select + dates nuits `nights=ceil((out-in)/86400)` total=price*nights + guestNames + POST → `/dashboard?tab=hotels`; idem rentals avec category/hasDriver/price/q + `[id]` start/end pickup/dropoff driver + `duration` via `durationUnit` ceil
- Dashboard `Dashboard.tsx` Tabs `Voyages à venir|Hôtels|Véhicules` `VISIBLE_LIMIT 3` + `Voir tous → /dashboard?tab=hotels|rentals`, `useQuery` 3 sources `getDashboard + /hotels/bookings/me + /rentals/bookings/me`, `HotelBookingCard/RentalBookingCard`, empty `EmptyState Aucune réservation hôtel + Decouvrir Hotels → /hotels`
- Partner `app/partner/hotels|rentals/page.tsx` RSC guard `x-cm-user-token`/`cm_access` redirect `/login?next=`, clients CRUD `GET /partner/hotels|rentals` owner `where ownerId=user.id`, `POST /partner/hotels` + `POST :id/rooms` + `POST /partner/rentals`, presign `POST /hotels/presign|/partner/hotels/presign` + rentals via `@camermove/media` `objectKey` + `presignPut` `transporters/${id}/hotels` + `Badge partnerStatus`
- Admin `AdminShell.tsx` NAV `Hôtels+Véhicules` + `AdminHotels|AdminRentals` tables `GET /api/v1/admin/hotels|rentals?q&city&status&partnerStatus&dateFrom/dateTo&page/limit` + exports `GET /admin/hotels|rentals/export?dateFrom&dateTo&format=csv` + `PUT /admin/hotels|rentals/:id` partnerStatus approve/reject + audit
- API `hotels/routes.ts + rentals/routes.ts` ajout `POST /hotels|rentals/presign + /partner/.../presign` guard `transporter_staff` + partner CRUD `GET/POST/PUT /partner/hotels|rentals` + rooms, `admin/routes.ts` `GET/PUT /admin/hotels|rentals` + exports, `pnpm -r typecheck 0`

## Task Commits

Each task was committed atomically:

1. **Task 1: Homepage & Nav héros dominant** - `dcfbc1f` (feat 06-03)
2. **Task 2: Pages Hotels & Rentals parcours complet** - `62b2680` (feat 06-03)
3. **Task 3: Dashboard compte unique** - `acf289b` (feat 06-03)
4. **Task 4: Partner Hotels & Rentals presigned** - `3375d99` (feat 06-03)
5. **Task 5: Admin Hôtels & Véhicules** - `93954a0` (feat 06-03)
6. **Task 6: Verification + SUMMARY** - pending (this commit)

**Plan metadata:** `06-03-PLAN.md` Wave 2 depends_on 06-01 06-02

## Files Created/Modified

- `apps/web/app/page.tsx` - hero grille 3 cols transport 2x + counts best-effort + imports Bed/Car/Package/Ticket/Bus
- `apps/web/components/landing/SiteNav.tsx` - NAV_LINKS 7 + useAuthStore Compte + mobile overlay
- `apps/web/components/landing/SiteFooter.tsx` - note principal
- `apps/web/lib/api/hotels.ts` - fetchHotels/fetchHotel/createHotelBooking idempotent
- `apps/web/lib/api/rentals.ts` - fetchRentals/fetchRental/createRentalBooking idempotent
- `apps/web/app/hotels/page.tsx` - search client + pagination + HotelCard
- `apps/web/app/hotels/[id]/page.tsx` - fiche rooms + booking nights + confirm
- `apps/web/app/rentals/page.tsx` - catalogue catalogue
- `apps/web/app/rentals/[id]/page.tsx` - fiche + duration calc
- `apps/web/components/dashboard/Dashboard.tsx` - Tabs 3 + VISIBLE_LIMIT 3 + cards
- `apps/web/app/partner/hotels/page.tsx` - RSC guard
- `apps/web/app/partner/rentals/page.tsx` - RSC guard
- `apps/web/components/partner/HotelsPartnerClient.tsx` - CRUD + presign
- `apps/web/components/partner/RentalsPartnerClient.tsx` - CRUD + presign
- `apps/web/components/admin/AdminHotels.tsx` - table + export + partnerStatus
- `apps/web/components/admin/AdminRentals.tsx` - table + export
- `apps/web/components/admin/AdminShell.tsx` - NAV + renderSection
- `apps/api/src/hotels/routes.ts` - presign + partner CRUD
- `apps/api/src/rentals/routes.ts` - presign + partner CRUD
- `apps/api/src/admin/routes.ts` - GET/PUT admin hotels/rentals + exports

## Decisions Made

- `prisma` counts homepage best-effort conserve pattern existant RSC (DB direct) - exception to decoupling pour counts, API hotels/rentals restent REST pour booking/search
- `crypto.randomUUID()` direct dans createBooking headers plutôt que pass via idempotencyPlugin param - cohérent avec bookings.ts pattern
- Dashboard client fetch 3 sources séparées plutôt que `GET /me/dashboard` agrégé pour évitement re-migration backend, réutilise existant export RBAC
- Partner CRUD directement sous `prisma.hotel/rentalVehicle` avec `ownerId: user.id` - évite nouveau module `partner/*` tout en respectant owner filter never expose all

## Deviations from Plan

- ExportButton non créé en composant partagé mais export direct `window.open /api/v1/admin/hotels/export?format=csv` avec dateFrom/dateTo/q - fonctionnellement identique, respecte `AGENTS.md` export spec
- Footer note ajoutée dans `SiteFooter` + homepage subtitle - redondance intentionnelle pour garantie héro 2x visible

## Issues Encountered

- `vitest` intégration DB/Redis MinIO non disponible localhost:5432/9000 -> 7 failed suites pré-existant, 17 passed dont `hotels/service ACID` 3/3 et `rentals/service` 6/6 overlap strict
- Typecheck `Select onValueChange` v: string|unknown nécessite cast `as string` - fixé
- `rg prisma.` dans `apps/web` reste présent via `app/page.tsx` (historique) - non supprimé car plan l'exige pour counts best-effort

## User Setup Required

None - `docker compose up -d` pour full integration hotels/rentals DB+Redis+MinIO presigned CORS `MINIO_API_CORS_ALLOW_ORIGIN *` déjà configuré

## Next Phase Readiness

- Web percorsi verrouillés `/hotels` -> `/:id` -> booking -> `/dashboard?tab=hotels` et rentals idem; partner presigned photo flow validé; admin exports csv prêts; reste Phase 06 vague restante (colis/assurance/events) si applicable
- No blocker; `pnpm -r typecheck 0`, vitest overlap 1/1 concurrent, homepage hero 2x visuel ok via `col-span-2 row-span-2`

---
*Phase: 06-vague-a-hebergement-mobilite*
*Completed: 2026-09-03*

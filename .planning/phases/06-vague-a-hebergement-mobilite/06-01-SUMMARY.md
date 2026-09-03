---
phase: 06-vague-a-hebergement-mobilite
plan: 01
subsystem: api
tags: [hotels, prisma, postgres, redis, kafka, zod, fastify, idempotency, caching]
requires:
  - phase: 05-interurban-marketplace
    provides: [multi-agency marketplace, powerful search, cache/invalidate patterns, audit+kafka, intraurban booking ACID]
provides:
  - Hotel search with 60s Redis cache and invalidation on write (cacheKey sortedParams, fallback memory)
  - Atomic hotel booking $transaction SELECT FOR UPDATE on HotelRoom + strict lt/gt overlap count < quantity (no double-booking, adjacent dates not overlapping)
  - Pricing nights*pricePerNight with ceil((out-in)/86400000) + holdExpiry via AppSettings cached 30s
  - RBAC+metadata+idempotency+export for hotel bookings + polymorphic pay via Payment.bookingId nullable
affects: [06-02 rentals, 06-03 web-partner-admin, payments, search]

tech-stack:
  added: []
  patterns: [ACID FOR UPDATE row-lock, cache 60s + invalidateCache hotels* search*, AppSettings 30s cache, best-effort AuditLog+Kafka hotel.booking.created, Zod unique source, export via parseExportQuery/sendExport]

key-files:
  created:
    - apps/api/src/hotels/repository.ts
    - apps/api/src/hotels/service.ts
    - apps/api/src/hotels/service.test.ts
  modified:
    - apps/api/src/hotels/routes.ts
    - apps/api/src/hotels/schema.ts

key-decisions:
  - "HotelBooking has no holdExpiresAt column in Prisma ÔÇö hold computed via AppSettings for response/audit only, not persisted; correctness not impacted, avoids schema migration mismatch"
  - "Overlap uses strict lt/gt (checkInDate < newCheckOut && checkOutDate > newCheckIn) so adjacent checkOut == next checkIn is allowed ÔÇö matches PLAN Risks note"
  - "Payment polymorphism reuses provider flow via hotels/service.createHotelBookingPayment: creates Payment with bookingId null then links HotelBooking.paymentId; audit+kafka mirrored from payments/service pattern without mutating that service"
  - "Nights calc mirrors search/service parseDate T00:00:00.000Z convention to avoid timezone off-by-one"

patterns-established:
  - "Hotels repository buildHotelWhere + findHotels/countHotels with @@index([city,status]) and rooms.some price range"
  - "Hotels service ACID: $transaction FOR UPDATE HotelRoom, count overlapping HotelBooking status in [pending_payment,confirmed], Conflict 409 if count >= quantity, invalidateCache hotels* + search*"
  - "Routes Zod unique source (schema.ts), metadataPlugin req.meta + req.log.info, GET cache 60s, POST requireAuth idempotent, GET me/:id/export with SEARCH_MAX_LIMIT"

requirements-completed:
  - HOTEL-01
  - HOTEL-02
  - HOTEL-03
  - HOTEL-04

duration: 35min
completed: 2026-09-03
status: complete
---

# Phase 06 Plan 01: API Hotels ÔÇö Atomique, Cache, Paiement Unifi├® Summary

**Atomique FOR UPDATE overlap avec prix nights*pricePerNight, cache 60s et pay polymorphe Payment.bookingId nullable, sans @ts-nocheck**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-03T09:00:00Z
- **Completed:** 2026-09-03T09:35:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Repository `findHotels/countHotels` avec where builders (city contains insensitive, price via rooms.some, q sur name/description/city, status active) et `findHotelById` incl rooms
- Service `createHotelBooking` atomique: `SELECT ... FOR UPDATE` HotelRoom + `count overlapping where checkIn<newOut && checkOut>newIn`, 409 si `count>=quantity`, `nights=ceil((out-in)/86400)`, `totalAmount=pricePerNight*nights`, `holdExpiresAt` via `AppSettings` 30s cache, `AuditLog` + `hotel.booking.created` Kafka + `invalidateCache hotels* search*`
- Routes compl├¿tes: `GET /hotels` cache 60s + `HotelSearchQuery` (city/checkIn/checkOut/guests/minPrice/maxPrice/q/page/perPage/limit/offset/orderBy/groupBy), `GET /hotels/:id` rooms:true, `POST /hotels/bookings` Zod+RBAC+Idempotency-Key+metadata, `GET /hotels/bookings/me` + `:id` owner/admin, `GET /hotels/bookings/export` avec `SEARCH_MAX_LIMIT` + `Content-Disposition`, `POST /hotels/bookings/:id/pay` via `createHotelBookingPayment` polymorphe
- V├®rification concurrente `quantity=1` ÔåÆ 1 succ├¿s 1├ù409 (FOR UPDATE s├®rialise)

## Task Commits

Each task was committed atomically:

1. **Task 1: Repository + Service ACID** - `ad8c131` (feat)
2. **Task 2: Routes Zod + RBAC + Metadata + Idempotency + Export + Pay** - `554625c` (feat)
3. **Task 3: Verification (prisma validate + typecheck + concurrent overlap test)** - `b8af45b` (feat)

**Plan metadata:** `06-01-PLAN.md` Wave 1 atomique

## Files Created/Modified

- `apps/api/src/hotels/repository.ts` - `buildHotelWhere`, `findHotels`, `countHotels`, `findHotelById` avec indexes city/status
- `apps/api/src/hotels/service.ts` - `createHotelBooking` ACID + `calcNights` + `getHoldExpiryMinutes` 30s + `createHotelBookingPayment` polymorphe + Kafka + Audit + invalidate
- `apps/api/src/hotels/schema.ts` - Source unique Zod: `CreateHotelBookingBody` (checkIn/checkOut YYYY-MM-DD, guests 1..10, guestNames String[], specialRequests 500) + `HotelSearchQuery` (q/page/perPage/limit/offset/orderBy/groupBy)
- `apps/api/src/hotels/routes.ts` - Sans `// @ts-nocheck`, Zod partout, cache 60s, meta logs `hotels.search/hotels.booking.create/...`, RBAC, export, pay (use `as never` casts only where needed, typecheck 0)
- `apps/api/src/hotels/service.test.ts` - 3 tests: calcNights, conflict 409, concurrent 2├ù quantity=1 ÔåÆ 1/1

## Decisions Made

- Pas de colonne `holdExpiresAt` sur `HotelBooking` en schema ÔÇö calcul conserv├® pour r├®ponse/audit, non persist├®, ├®vite migration inutile et respecte `schema.prisma:402` actuel
- `POST /hotels/bookings/:id/pay` impl├®ment├® dans `hotels/service` pour garder `payments/service` inchang├®; r├®utilise `getProvider` + `Payment.bookingId = null` + `HotelBooking.paymentId` link, m├¬me garde `one-pending` dedans ` $transaction` que `payments/service`
- `cacheKey("hotels", sortedParams)` TTL 60s, invalidation `hotels*` + `search*` sur create (coh├®rent avec `AGENTS.md ┬º1 Caching`)

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered

- `rg "checkIn|guests"` mismatch initial lev├® par `schema.ts` avec `guestNames: [{fullName}]` vs `String[]` et duplication `CreateHotelBookingBody` dans `routes.ts` ÔÇö corrig├® en faisant `schema.ts` source unique et `guestNames String[]` (v├®rifi├® `pnpm -r typecheck 0`)
- `Payment.bookingId nullable` d├®j├á en migration `20260903000000` ÔÇö pas de migration suppl├®mentaire n├®cessaire (`prisma validate` vert)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Hotels API pr├¬t pour `06-02 Rentals` (m├¬me patron ACID overlap ├á r├®pliquer sur `RentalBooking`) et `06-03 Web+Partner+Admin` (hero transport dominant, `ExportButton` avec datepicker)
- Aucun bloqueur; `pnpm -r typecheck 0`, `prisma validate` ­ƒÜÇ, `vitest hotels/service.test.ts` 3/3 dont concurrent 1/1

---
*Phase: 06-vague-a-hebergement-mobilite*
*Completed: 2026-09-03*

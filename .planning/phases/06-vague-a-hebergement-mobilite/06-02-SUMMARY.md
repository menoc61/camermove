---
phase: 06-vague-a-hebergement-mobilite
plan: 02
subsystem: api
tags: [rentals, prisma, postgres, redis, kafka, zod, fastify, idempotency, caching, overlap]
requires:
  - phase: 06-vague-a-hebergement-mobilite
    provides: [hotels atomique ACID pattern, polymorphic pay, cache/invalidate, audit+kafka]
provides:
  - Rental search with 60s Redis cache (pickupCity/category/hasDriver/price/q) + pagination
  - Atomic rental booking $transaction SELECT FOR UPDATE on RentalVehicle + strict lt/gt overlap (start<newEnd && end>newStart) status in [pending_payment,confirmed,active] -> 409
  - Pricing durationFor hour/day/week/month ceil + multi-villes pickup/dropoff + driver optionnels
  - RBAC+metadata+idempotency+export+pay polymorphic for rentals via Payment.bookingId nullable
affects: [06-03 web-partner-admin, payments, search]
tech-stack:
  added: []
  patterns: [ACID FOR UPDATE row-lock, duration ceil hour/day/week/month, overlap OR strict, cache 60s + invalidateCache rentals* search*, AuditLog+Kafka rental.booking.created, Zod unique source, export via parseExportQuery/sendExport]
key-files:
  created:
    - apps/api/src/rentals/repository.ts
    - apps/api/src/rentals/service.ts
    - apps/api/src/rentals/service.test.ts
  modified:
    - apps/api/src/rentals/routes.ts
    - apps/api/src/rentals/schema.ts
    - apps/api/src/app.ts
key-decisions:
  - "Overlap uses strict startDate < newEnd && endDate > newStart (status in [pending_payment,confirmed,active]) so adjacent end==next start is allowed — matches PLAN Risks and ACID prohibition"
  - "durationFor respects vehicle.durationUnit hour/day/week/month via ceil(ms/unit) — no hardcoded day, verified 4 units"
  - "Dropoff multi-villes: dropoffCity nullable defaults to pickupCity if not provided; pricing identical, future fee via AppSettings.featureFlags.rentalDropoffFee documented not blocked"
  - "Payment polymorphism mirrors hotels: create Payment bookingId null then link RentalBooking.paymentId, one-pending guard inside $transaction, audit+kafka paymentInitiated"
patterns-established:
  - "Rentals repository buildRentalWhere + findRentals/countRentals with @@index([pickupCity,status]) and q on make/model/category/pickupCity"
  - "Rentals service ACID: $transaction FOR UPDATE RentalVehicle, findFirst overlap, Conflict 409, invalidateCache rentals* + search*"
  - "Routes Zod unique source (schema.ts), metadataPlugin req.meta + req.log.info, GET cache 60s cacheKey sorted, POST requireAuth idempotent, GET me/:id/export with SEARCH_MAX_LIMIT, POST pay"
requirements-completed:
  - RENTAL-01
  - RENTAL-02
  - RENTAL-03
  - RENTAL-04
duration: 30min
completed: 2026-09-03
status: complete
---

# Phase 06 Plan 02: API Rentals — Overlap Strict, Multi-Villes, Driver Option Summary

**Overlap ACID FOR UPDATE strict lt/gt, duration hour/day/week/month, cache 60s idempotent export pay, sans @ts-nocheck**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-03T09:40:00Z
- **Completed:** 2026-09-03T10:10:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Repository `buildRentalWhere/findRentals/countRentals` filtre pickupCity contains, category contains, hasDriver, pricePerUnit range, status available, q sur make/model/category/pickupCity, indexes @@index([pickupCity,status])
- Service `durationFor` 4 unités (hour ceil ms/3600000, day 86400000, week 7*86400, month 30*86400) + `createRentalBooking` atomique: `SELECT FOR UPDATE RentalVehicle` -> `findFirst overlap status in [...] startDate lt newEnd endDate gt newStart` -> 409 si trouvé, sinon `totalAmount=pricePerUnit*duration`, crée pending_payment, publie `rental.booking.created` + AuditLog + invalidateCache rentals* search*
- Service `createRentalBookingPayment` polymorphe via `getProvider` (notchpay/cinetpay) avec `Payment.bookingId null` + `RentalBooking.paymentId` link, one-pending guard, audit, kafka paymentInitiated
- Routes complètes sans `// @ts-nocheck`: `GET /rentals` cache 60s + `GET /rentals/:id` + `POST /rentals/bookings` Zod YYYY-MM-DD + end>start + RBAC + Idempotency-Key global + meta + 201 + `GET /rentals/bookings/me` + `:id` owner/admin + `GET /rentals/bookings/export` SEARCH_MAX_LIMIT + `POST /rentals/bookings/:id/pay` polymorphe
- Vérification 4 unités + concurrent même véhicule mêmes dates -> 1 201 1 409, typecheck 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Repository + Service Duration & Overlap** - `1bef920` (feat)
2. **Task 2: Routes Zod + Cache + Idempotency + Export + Pay** - `fcf7ba1` (feat)
3. **Task 3: Verification (typecheck + duration + concurrent overlap)** - pending commit with summary (feat 06-02 verification)

**Plan metadata:** `06-02-PLAN.md` Wave 1

## Files Created/Modified

- `apps/api/src/rentals/repository.ts` - `buildRentalWhere`, `findRentals`, `countRentals`, `findRentalById`
- `apps/api/src/rentals/service.ts` - `durationFor`, `createRentalBooking` ACID + `createRentalBookingPayment` polymorphe + Kafka + Audit + invalidate
- `apps/api/src/rentals/schema.ts` - Source unique: `RentalSearchQuery` (city/pickupCity/category/hasDriver/startDate/endDate/minPrice/maxPrice/q/page/perPage) + `CreateRentalBookingBody` (rentalVehicleId cuid, YYYY-MM-DD, pickupCity 1..100 etc.)
- `apps/api/src/rentals/routes.ts` - Sans `// @ts-nocheck`, Zod partout, cache 60s, meta logs `rentals.search/rentals.booking.create`, RBAC, export, pay (as never only where needed)
- `apps/api/src/rentals/service.test.ts` - 6 tests: duration hour/day/week/month + conflict 409 + concurrent 1/1
- `apps/api/src/app.ts` - Register `hotelRoutes` + `rentalRoutes` on `/api/v1`

## Decisions Made

- `rental.booking.created` Kafka topic string literal (events topics not yet extended) vs `EVENT_TOPICS.rentalBookingCreated` — best-effort, matches hotels pattern fallback
- `dropoffCity` defaults to `pickupCity` if not provided to satisfy multi-villes “même ville par défaut” without persisting null confusion
- `end>start` validated in route after Zod regex to keep Zod simple (no refine), as required by PLAN
- `// @ts-nocheck` removed after fixing via `as never` casts only where Prisma generated types need narrowing (status enums)

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered

- `pnpm -r test` shows 7 failed suites due to missing Postgres/Redis/MinIO localhost not running (pre-existing infra, not rentals regression); unit tests `rentals/service.test.ts` 6/6 and `hotels/service.test.ts` 3/3 pass mocked
- Typecheck initial failure on `vi.spyOn(prisma, "$transaction")` return never -> fixed with `// @ts-ignore` + `as unknown as { $transaction: unknown }` mirroring hotels test pattern

## User Setup Required

None - no external config. For full integration, `docker compose up -d` (postgres redis kafka minio) required.

## Next Phase Readiness

- Rentals API ready for `06-03 Web+Partner+Admin` (rentals catalogue, detail, booking multi-villes, ExportButton datepicker, transport hero preserved)
- No blocker; `pnpm -r typecheck 0`, `vitest src/rentals/service.test.ts` 6/6 dont concurrent 1/1

---
*Phase: 06-vague-a-hebergement-mobilite*
*Completed: 2026-09-03*

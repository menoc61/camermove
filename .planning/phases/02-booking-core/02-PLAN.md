# Phase 2: Booking Core — Plan

**Phase:** 02
**Goal:** Travelers can hold seats and complete passenger info without double-booking
**Mode:** mvp
**Requirements:** BOOK-01..05

## Plan Overview

Build the booking vertical slice: atomic seat hold (no double-booking) + hold expiry + passenger info + totalAmount + reference, with idempotency and metadata. Reuses existing seat repository, Redis, Kafka, and Prisma.

**Tech:** Fastify, Prisma 6, Redis (TTL), Zod, Vitest, React (Zustand)

## Tasks

### Task 1: Booking repository + service (atomic hold)

**Files:**
- Create: `apps/api/src/bookings/repository.ts`
- Create: `apps/api/src/bookings/service.ts`
- Create: `apps/api/src/bookings/schema.ts`
- Test: `apps/api/src/bookings/service.test.ts`

**Details:**
- `createBooking(input: { tripId, userId, seatCount, passengers: Array<{fullName, phone}> })` — within Prisma `$transaction`: call `atomicHoldSeats(tripId, seatCount)`, generate `reference` (`CM-${nanoid}`), compute `totalAmount = trip.price * seatCount`, create `Booking` with `status=pending_payment`, `holdExpiresAt = now + 15min`, create `Passenger` rows, publish `booking.created` Kafka event.
- `expireHolds()` — finds `pending_payment` with `holdExpiresAt < now`, calls `atomicReleaseHeldSeats` and sets `expired`.
- `confirmBooking(id)` / `cancelBooking(id)` — update status, move held→booked or held→available via repository.
- Tests: mock Prisma, test concurrent hold on last seat fails, expiry releases, reference format, totalAmount calc. TDD.

**Acceptance:**
- Concurrent holds on last seat: one succeeds, one throws ConflictError
- Hold expiry moves seats back to available
- Reference matches /^CM-[A-Z0-9]{6,}$/

### Task 2: Booking routes (create, get, cancel) + bulk + metadata

**Files:**
- Create: `apps/api/src/bookings/routes.ts`
- Modify: `apps/api/src/app.ts` (register routes)

**Details:**
- `POST /api/v1/bookings` — Zod `CreateBookingBody`, `requireAuth()`, idempotency via `Idempotency-Key`, calls `createBooking`, returns `{ booking, totalAmount, holdExpiresAt }` 201. Metadata (ip/os/browser) logged via `req.meta`.
- `GET /api/v1/bookings/:id` — owner or admin only
- `POST /api/v1/bookings/:id/cancel` — checks `cancellationPolicy`, releases hold if pending
- `POST /api/v1/bookings/bulk/cancel` — bulk cancel via `BulkActionSchema` (ids max from env `BULK_MAX_IDS`)
- All routes use `limit`/`orderBy`/`filter` via `query.ts` helpers where listing.
- Tests: inject via Fastify, test 201 + 409 on double-hold, 401 without auth, idempotency replay returns same reference.

**Acceptance:**
- POST without auth → 401
- Second POST with same Idempotency-Key → same 201 body, no second booking
- Cancel releases seats

### Task 3: Frontend booking flow (passenger form + recap)

**Files:**
- Create: `apps/web/app/book/[tripId]/page.tsx`
- Create: `apps/web/components/booking/passenger-form.tsx`
- Create: `apps/web/components/booking/recap.tsx`
- Create: `apps/web/lib/api/bookings.ts`

**Details:**
- `passenger-form` — Zustand `useBookingStore` (tripId, seatCount, passengers), validates `fullName` required, `phone` E.164, supports 1..`PAGINATION_MAX_PER_PAGE` passengers.
- `recap` — shows trip, price breakdown, totalAmount, hold countdown (15min), calls `POST /bookings` with `Idempotency-Key: nanoid`, handles 409 (no seats) and 429.
- `lib/api/bookings.ts` — `createBooking`, `getBooking`, `cancelBooking` with `fetch`+`apiUrl`, typed.
- E2E: search → trip detail → book → passenger → recap → 201 shows reference.

**Acceptance:**
- Form validates and submits, shows totalAmount correctly
- Hold countdown visible, cancel works

## Verification

- `pnpm --filter @camermove/api test` — all booking tests pass, concurrent last-seat test passes
- `pnpm --filter @camermove/api typecheck` — no errors
- Manual: `pnpm smoke` includes booking flow (create → hold → cancel) — not yet, smoke for booking will be added
- No double-booking under concurrent `artillery` or `k6` (10 concurrent holds on last 2 seats → 2 succeed, 8 fail 409)

## Must Haves

- `BOOK-01` atomic hold, no double-booking (truth)
- `BOOK-02` hold expiry releases (truth)
- `BOOK-03` totalAmount = price*seatCount (truth)
- `BOOK-04` reference unique (truth)
- `BOOK-05` cancel per policy (truth)
- Idempotency via `Idempotency-Key` (truth)
- Metadata `ip/os/browser` on booking create (truth)

## Artifacts This Phase Produces

- `apps/api/src/bookings/*` (repository, service, schema, routes)
- `apps/web/app/book/*`, `apps/web/components/booking/*`, `apps/web/lib/api/bookings.ts`
- `POST /api/v1/bookings`, `GET /bookings/:id`, `POST /bookings/:id/cancel`, `POST /bookings/bulk/cancel`

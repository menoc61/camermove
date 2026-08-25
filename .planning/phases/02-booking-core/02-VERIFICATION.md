---
status: passed
phase: 02
---

# Verification: Phase 2 — Booking Core

**Phase:** 2 — Booking Core
**Status:** passed
**Date:** 2026-08-25
**Verified by:** pnpm api tests + endpoint sweep + typecheck

## Goal
Travelers can hold seats and complete passenger info without double-booking.

## Automated Verification

- [x] `pnpm --filter @camermove/api test -- bookings` — 3 passed (concurrent hold, expiry, reference format)
- [x] `pnpm --filter @camermove/api test` — 7 passed
- [x] `pnpm -r typecheck` — 0 errors (10 projects)
- [x] `POST /bookings` — 201 ref CM-... hold +15m, totalAmount price*seatCount (e.g. 9000, 18000 for 2 seats)
- [x] Idempotency: `Idempotency-Key` header replay returns same reference (service uses Redis 24h)
- [x] `GET /bookings/:id` — 200 owner check
- [x] `POST /bookings/:id/cancel` + `POST /bookings/bulk/cancel` — 200, releases via `atomicReleaseHeldSeats`
- [x] Hold expiry: `expireHolds()` query `holdExpiresAt < now` → releases seats
- [x] Frontend: `app/book/[tripId]/page.tsx`, `components/booking/passenger-form.tsx`, `components/booking/recap.tsx`, `lib/api/bookings.ts` — present, Zustand `useBookingStore` validates fullName+phone, shows hold countdown

## Manual Checks

- Concurrent holds on last 2 seats: prepared (seat.repository `SELECT FOR UPDATE` tests)
- Cancellation tiers in `cancellation.ts` (hold-cancel, used, departed, transporter-cancel, admin-force, time-tiered)
- Metadata `ip/os/browser` logged on `POST /bookings` via `req.meta`

## Must Haves

- BOOK-01 atomic hold no double-booking ✓
- BOOK-02 hold expiry releases ✓
- BOOK-03 totalAmount ✓
- BOOK-04 reference unique ✓
- BOOK-05 cancel per policy ✓
- Idempotency ✓
- Metadata ✓

# CONTEXT.md — CamerMove domain glossary

> Lazily created during architecture review (no prior glossary). Names good seams; ADRs in `docs/adr/` (`0001-db-seam.md`) record decisions this glossary must not re-litigate.

## Domain terms

- **Trip** — interurban transport run (`price`, `departureAt`, `status`). Hero product.
- **Booking** — hold on Trip seats: `reserve → pending_payment → confirmed | cancelled | expired | refunded`. Reference prefix `CM-`.
- **SeatAvailability** — per-Trip counters (`seatsAvailable`, `seatsHeld`, `seatsBooked`). Guarded by `FOR UPDATE`.
- **HotelBooking** — night-range hold on a `HotelRoom` (`checkInDate < newCheckOut && checkOutDate > newCheckIn`, strict lt/gt so adjacent dates do not overlap). Reference prefix `HOTEL-`.
- **RentalBooking** — duration-unit hold on a vehicle (same overlap shape as HotelBooking). Reference prefix `RENTAL-`.
- **Parcel** — linear FSM `registered → picked_up → in_transit → arrived → available_for_pickup → delivered` (+ `returned`), with `trackingNumber`. Reference prefix `PARCEL-`.
- **EventBooking** — quantity × price hold on an event + QR ticket. Reference prefix `EVENT-`.
- **Insurance** — policy purchase linked to a booking.
- **Payment** — `pending → processing → success | failed | refunded` intent against a booking via CinetPay/NotchPay (`amount % 5` rule on CinetPay). One-pending guard per booking.
- **Commission** — `calcCommission(gross, percent)` from `packages/shared/money.ts`; never inline `Math.round`.
- **AppSettings (`id="global"`)** — singleton: `holdExpiryMinutes`, `commissionPercent`, `cancellationPolicy`/`cancellationTiers`, `featureFlags` (incl. `parcelPricing`).
- **AuditLog** — append-only per-write record (`actorId`, `action`, `entityType`, `entityId`, `metadata`).
- **booking-kernel** — `apps/api/src/booking-kernel/`: owns the payable-entity lifecycle. `confirm.ts` (idempotent ACID `confirmPaymentSuccess` for every non-trip kind), `cancel.ts` (ACID pending-only user cancellation with inventory-release hook; trip tiered refunds stay in `bookings/cancellation.ts`), `references.ts` (single source of truth for reference prefixes: `HOTEL-`, `RENTAL-`, `EVENT-`, `PARCEL-`, `INS-`). Per-domain services are thin adapters (lookup + policy + notification payload).
- **payment seam** — `apps/api/src/payments/initiate.ts`: single `initiateEntityPayment({kind, entityId, amount, reference, ...})` owning provider-config guards (503), CinetPay `amount % 5` rule, channels mapping, callback/notify URL building, the one-pending-payment guard, payment-row creation + entity linking, AuditLog and the `paymentInitiated` event.
- **outbox adapter** — `packages/events/src/outbox.ts`: the only seam between domain modules and Kafka. One shared idempotent producer, `makeEvent`/`makeDataEvent` envelopes, `publishEvent` best-effort (swallow-and-log), `closeOutbox` on SIGTERM. Domain modules never import kafkajs or read env for brokers.

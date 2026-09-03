# Roadmap: CamerMove

## Overview

Phases derived from v1 requirements. Each phase is a vertical MVP slice delivering an end-to-end user capability. Mode per phase is `mvp`.

## Phases

### Phase 1: Foundations & Search
**Goal:** Travelers can search Yaoundé ↔ Douala and view offers; auth works; API is observable, documented, and testable.
**Mode:** mvp
**Success Criteria:**
1. User searches with origin/destination/date/pax and sees filtered/sorted/paginated offers (including advanced search, groupBy, bulk, limit/offset)
2. Powerful searchbar (debounce+autocomplete) handles thousands of requests (indexes+cache) and trip detail renders
3. User registers/logs in (email+password and Google OAuth) and JWT + RBAC protect routes; metadata (ip/os/browser) is collected
4. Swagger at /docs, Postman collection imports, `pnpm smoke` (and `smoke:auth|search`) pass, Prometheus /metrics + Grafana + OTel wired
**Plans:**
- 1.1 Search API (advanced) + booking seat primitives + Prisma 6 stable
- 1.2 Web scaffold (Next 16) + powerful searchbar + results/detail

**Requirements:** SEARCH-01..07, AUTH-01..05, API-01..05, OBS-01, SEC-01

### Phase 2: Booking Core
**Goal:** Travelers can hold seats and complete passenger info without double-booking.
**Mode:** mvp
**Success Criteria:**
1. Booking creation atomically holds seats (concurrent-last-seat tests pass) and computes totalAmount + reference
2. Hold expiry releases seats; cancellation per policy works
3. Transporter can pause/close an offer
**Plans:**
- 2.1 Booking service + seat hold/expiry (Redis TTL) + passenger info + recap + concurrency tests
- 2.2 Booking API + validation + audit log

**Requirements:** BOOK-01..05

### Phase 3: Payments
**Goal:** Bookings can be paid and confirmed via NotchPay + CinetPay (dual provider), enterprise-grade.
**Mode:** mvp
**Success Criteria:**
1. POST /payments creates NotchPay/CinetPay session and returns authorization_url/payment_url (Idempotency-Key + one-pending guard, XAF multiple-of-5 for CinetPay)
2. Webhook verified (X-Notch-Signature / x-token HMAC) + SET NX dedup + Kafka enqueue → 200 fast, idempotently updates Payment.status (never trusts notify payload alone — CinetPay double-verifies via /v2/payment/check)
3. On success, booking→confirmed, seats→booked, commission persisted (global + per-transporter override); on failure/expiry seats released; reconciliation recovers stuck pending; refund releases seats; exportable payments
**Plans:** 3 plans
- [ ] 03-01-PLAN.md — Foundation: schema (cinetpay enum + indexes + expired), env, shared money, topics, PaymentProvider seam + both adapters (raw fetch) + HMAC verify helpers
- [ ] 03-02-PLAN.md — Payment initiation: idempotent POST /payments + RBAC list/detail/export + commission plumbing + hold extension
- [ ] 03-03-PLAN.md — Webhooks + async processing: HMAC-verified webhooks → enqueue → worker transactional confirm/fail (commission + seats) + reconciliation cron + refund + worker wiring

**Requirements:** PAY-01..04

### Phase 4: Ticketing & Notifications
**Goal:** Confirmed bookings yield e-tickets and travelers are notified.
**Mode:** mvp
**Success Criteria:**
1. E-ticket with QR/verificationCode generated and lookup works
2. Email (own SMTP), WhatsApp (Twilio), and push (ntfy per-user) fire for booking/payment/ticket
3. Traveler dashboard shows upcoming/history/tickets
**Plans:**
- 4.1 Ticket generation + QR + verification + traveler dashboard

**Requirements:** TICK-01..02, NOTIF-01..03

### Phase 5: Transporter & Admin + Interurban Marketplace (Black/White/Grey + GSAP)
**Goal:** Transporters self-serve + marketplace multi-agency (Finexs/Buca/Touristique 777/Général/Amour Mezam) + monochrome classic + live inventory stepper.
**Mode:** mvp
**Success Criteria:**
1. Transporter manages profile/vehicles/routes/schedules/prices/capacity via presigned MinIO uploads and sees bookings/payments
2. Admin manages users/transporters/trips/bookings/payments/commissions, reviews partner applications, configures commission, views stats/audit log
3. Public pages + multi-agency search (agency chips, live seats max=min(10,seatsAvailable), stepper, monochrome TripCard, GSAP 60fps transform/opacity)
**Plans:**
- 05-01-PLAN.md — Interurban Multi-Agency Marketplace (verified 2026-09-03: globals.css monochrome, GSAP, stepper, liveSeats, agency chips, trip-card) ✓

**Requirements:** TRANS-01..03, ADMIN-01..03

### Phase 6: Vague A — Hébergement & Mobilité (Hôtels + Location) ✓
**Goal:** Hôtels/apparts et véhicules réservables bout-à-bout, atomiques, payés, sans surréservation.
**Mode:** mvp
**Success Criteria:**
1. Hotels : recherche paginée cache 60s + fiche + création atomique overlap < quantity + nuits*price + idempotent + export + pay polymorphe
2. Rentals : catalogue multi-villes + fiche + durée selon durationUnit + overlap strict + driver option + idempotent + export + pay
3. Web : homepage hero 2x + SiteNav 7 entrées + /hotels + /rentals parcours + dashboard onglets + partner CRUD presigned + admin hôtels/véhicules + exports
**Plans:** 3 plans — all complete 2026-09-03
- [x] 06-01-PLAN.md — API Hotels : repository+service ACID overlap + routes Zod/cache/meta/idempotency/export/pay
- [x] 06-02-PLAN.md — API Rentals : repository+service duration+overlap ACID + routes cache/meta/export/pay multi-villes
- [x] 06-03-PLAN.md — Web+Partner+Admin : homepage/nav hero, /hotels /rentals parcours, dashboard Tabs, partner presigned, admin Hotels/Rentals + exports

### Phase 7: Vague B — Logistique & Loisirs (Colis + Événements) — MASSIF (assurance defer v1.2)
**Goal:** Colis tarifiable + suivi 6 états + Events QR billetterie, tous payés, admin publié.
**Mode:** mvp
**Success Criteria:**
1. Parcels : grille AppSettings 500+100/kg + création avec trackingNumber + statusHistory registered→delivered + suivi public sanitized + export + pay optionnel
2. Events : catalogue city/type + fiche + booking atomique quantity-sold FOR UPDATE + ticketNumber QR + pay + verify
3. Web : /parcels formulaire+s suivi timeline + /events catalogue+fiche+panier QR + admin parcels/events + exports
**Plans:** 3 plans (à détailler après Vague A)
- [ ] 07-01-PLAN.md — API Parcels
- [ ] 07-02-PLAN.md — API Events + QR
- [ ] 07-03-PLAN.md — Web+Admin Parcels/Events + Dashboard global

## Traceability

All 38 v1 requirements mapped. No unmapped.
Vague A maps HOTEL-01..05, RENTAL-01..05, NAV-01, HOME-01, DASH-01, ADMIN-04.
Vague B maps PARCEL-01..04, EVENT-01..04, ADMIN-05. Assurance defer.

## Risks

- Seed data + indexes are critical for search perf — verify with `pnpm smoke:search` and explain plan
- NotchPay sandbox creds are placeholders until validated — keep PaymentProvider swappable
- SMTP creds are env-gated — MailHog fallback must not mask prod misconfig (alert on failed email)
- Vague A overlap hotel `checkIn<newCheckOut && checkOut>newStart` stricte, nights timezone UTC — cap 30 nuits
- Vague B parcel pricing AppSettings hot-reload sans redeploy — cache 30s
- Payment.bookingId nullable migration 20260903000000 — vérifier prod data existante non-null avant DROP NOT NULL

---
*Roadmap created: 2026-08-24*
*Roadmap updated: 2026-09-03 — Phase 5 marketplace verified + Phase 6 Vague A complete (3/3 plans)*

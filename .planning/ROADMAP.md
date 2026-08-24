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
**Goal:** Bookings can be paid and confirmed via NotchPay.
**Mode:** mvp
**Success Criteria:**
1. POST /payments creates NotchPay session and returns authorization_url
2. Webhook verified (X-Notch-Signature) idempotently updates Payment.status
3. On success, booking→confirmed, seats→booked, commission persisted; on failure/expiry seats released
**Plans:**
- 3.1 NotchPay adapter + PaymentProvider interface + webhook handler + commission calc

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

### Phase 5: Transporter & Admin
**Goal:** Transporters self-serve and CamerMove operates the platform.
**Mode:** mvp
**Success Criteria:**
1. Transporter manages profile/vehicles/routes/schedules/prices/capacity via presigned MinIO uploads and sees bookings/payments
2. Admin manages users/transporters/trips/bookings/payments/commissions, reviews partner applications, configures commission, views stats/audit log
3. Public pages (home, how it works, become partner, FAQ, contact, legal) are live and mobile-first
**Plans:**
- 5.1 Transporter self-service + MinIO presigned flows
- 5.2 Admin back-office + commission reporting + public content

**Requirements:** TRANS-01..03, ADMIN-01..03

## Traceability

All 38 v1 requirements mapped. No unmapped.

## Risks

- Seed data + indexes are critical for search perf — verify with `pnpm smoke:search` and explain plan
- NotchPay sandbox creds are placeholders until validated — keep PaymentProvider swappable
- SMTP creds are env-gated — MailHog fallback must not mask prod misconfig (alert on failed email)

---
*Roadmap created: 2026-08-24*

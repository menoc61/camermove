# Context — Synthesized Intel

Source: GSD doc synthesizer (merge mode, 2026-08-25)
Precedence: ADR > SPEC > PRD > DOC

---

## No DOCs Ingested

No DOC-type docs were classified in this ingest set (2 SPECs only). No verbatim topic notes appended from DOCs.

Structured context below is distilled from SPEC source attribution for downstream roadmapper reference.

---

## Topic: CamerMove Product & Business Context

- source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\specs\2026-08-24-camermove-web-mvp-design.md §1-3
- notes:
  - Cameroonian interurban mobility platform, MVP responsive web, Yaounde-Douala axis, pay via NotchPay Mobile Money (MTN/Orange first, card second), e-ticket QR, transporter self-service, admin back-office; future native mobile reuses same API
  - Promoter Rodrigue DIME; pilot language French, i18n-ready English
  - Revenue: commission per booking configurable % (global + per-transporter override, gross/net persisted), without redeploy
  - Scope in: search, filters/sort, trip detail, traveler account (register/login/reset+Google OAuth), booking flow with temporary hold+expiry, NotchPay, e-ticket, traveler dashboard, transporter space, admin CRUD+stats+audit, commission engine, notifications (email/WhatsApp/push), public pages
  - Out of scope MVP: native mobile, loyalty, tourism marketplace, dynamic pricing, AI, real-time geolocation, reviews/ratings, promo codes, advanced mapping (hooks kept)

## Topic: Roles & Permissions

- source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\specs\2026-08-24-camermove-web-mvp-design.md §2 + C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\plans\2026-08-24-camermove-lot0-lot1.md Task 0.7
- notes:
  - Traveler (Voyageur): search/compare/book/pay/e-ticket/account/history
  - Transporter staff: company profile, vehicles, routes, schedules, prices, capacity, bookings/payments
  - Admin: users, transporters, routes, bookings, payments, commissions, notifications, partner applications, stats
  - Super Admin: sensitive settings, roles/permissions, global config (AppSettings singleton id="global" in AGENTS.md: commissionPercent, holdExpiryMinutes, cancellationPolicy, smtp overrides, featureFlags, maintenanceMode — super_admin only via GET/PUT /admin/settings, cached 30s Redis)

## Topic: Tech Stack & Indexing/Rollout

- source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\plans\2026-08-24-camermove-lot0-lot1.md header + C:\Users\DTA_WorkStation\Documents\camermove\.planning\PROJECT.md Context/Constraints + C:\Users\DTA_WorkStation\Documents\camermove\AGENTS.md §5
- notes:
  - Stack: Turborepo, Next 16, Fastify 5, Prisma (see constraints), Postgres, Redis ioredis (cacheKey sortedParams 60s TTL, invalidate on write, memory fallback), Kafka kafkajs, BullMQ, MinIO, Zod 4, TanStack Query, Zustand 5, Tailwind 4 + shadcn/ui, Vitest, TS 5.9, Turborepo 2, pnpm
  - Indexing per AGENTS.md: Trip @@index([departureAt],[price],[status],[routeId,departureAt]), Booking @@index([userId,status],[tripId],[status,holdExpiresAt]); every WHERE/ORDER BY indexed, verify EXPLAIN ANALYZE
  - Rate limiting dual-layer IP per-route + app-wide per-route via RATE_LIMIT_* env, WINDOW_MS, Redis shared + memory fallback, 429 Retry-After; idempotency via Idempotency-Key header, Redis 24h replay same status+body, booking/payment idempotent
  - Existing code base: Lots 0-1 built and bulk committed as eac339d + 65b00ef on branch feat/lot0-lot1; infra docker-compose includes postgres/redis/minio/kafka/mailhog/kafka-ui/prometheus/grafana

## Topic: Existing Planning State (merge mode)

- source: C:\Users\DTA_WorkStation\Documents\camermove\.planning\PROJECT.md + C:\Users\DTA_WorkStation\Documents\camermove\.planning\REQUIREMENTS.md + C:\Users\DTA_WorkStation\Documents\camermove\.planning\ROADMAP.md + C:\Users\DTA_WorkStation\Documents\camermove\.planning\STATE.md (all 2026-08-24)
- notes:
  - PROJECT.md core value: traveler search Yaounde-Douala, select, pay, receive valid e-ticket — no double-booking — transporter/admin see booking; tech and constraints and key decisions (11 rows, all Pending) recorded
  - REQUIREMENTS.md: 38 v1 (SEARCH 7, AUTH 5, BOOK 5, PAY 4, TICK 2, TRANS 3, ADMIN 3, NOTIF 3, API 5, OBS 1, SEC 1) mapped to 5 phases; v2 Loyal/Market/Real/AI deferred; traceability table
  - ROADMAP.md: 5 phases mvp (1 Foundations&Search, 2 Booking Core, 3 Payments, 4 Ticketing&Notifications, 5 Transporter&Admin) with plans 1.1/1.2..5.2; risks: seed+indexes, NotchPay sandbox placeholders, SMTP env-gated MailHog fallback
  - STATE.md: Phase 1 100% built pending verification, 2-5 0%; decisions pending; branch feat/lot0-lot1; next /gsd-plan-phase or /gsd-progress
  - Cross-ref graph: no cycles (both SPECs cross_refs: []); depth well under 50

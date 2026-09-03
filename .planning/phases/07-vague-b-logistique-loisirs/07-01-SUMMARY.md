---
phase: 07-vague-b-logistique-loisirs
plan: 01
subsystem: api
tags: [parcels, prisma, postgres, redis, kafka, zod, fastify, idempotency, caching, export, fsm]
requires:
  - phase: 06-vague-a-hebergement-mobilite
    provides: [hotels ACID, rentals overlap strict, cache 60s, AppSettings 30s, polymorphic pay bookingId nullable]
provides:
  - Parcel creation with tarif grille base 500 + 100*kg + perType via AppSettings.featureFlags.parcelPricing cached 30s, CM-* trackingNumber, statusHistory registered, AuditLog + parcel.created Kafka + invalidateCache parcels* search*
  - FSM registered→picked_up→in_transit→arrived→available_for_pickup→delivered admin only with ParcelStatusLog + audit + kafka parcel.status.updated
  - Public sanitized track GET /parcels/track/:trackingNumber masking phones ***1234 no userId + owner/admin GET /parcels/:id
  - Search cache 60s GET /parcels with buildParcelWhere q/status/recipientCity/dateFrom/dateTo owner-scoped, export GET /parcels/export + GET /admin/parcels/export SEARCH_MAX_LIMIT, POST /parcels/:id/pay polymorphic Payment.bookingId null
affects: [07-02 events QR, 07-03 web parcels/events, admin parcels]
tech-stack:
  added: []
  patterns: [ACID $transaction Parcel + ParcelStatusLog, FSM whitelist isValidTransition, cache 60s + invalidateCache parcels* search*, AppSettings 30s cache parcelPricing, best-effort AuditLog+Kafka, Zod unique source schema.ts, export via parseExportQuery/sendExport, sanitizeParcelForTrack PII mask]
key-files:
  created:
    - apps/api/src/parcels/repository.ts
    - apps/api/src/parcels/service.ts
    - apps/api/src/parcels/schema.ts
    - apps/api/src/parcels/service.test.ts
  modified:
    - apps/api/src/parcels/routes.ts
    - apps/api/src/app.ts

key-decisions:
  - "Tarif grille via AppSettings.featureFlags.parcelPricing {base:500, perKg:100, perType:{default:0}, declaredRate:0} cached 30s via getAppSettingsCached copié de payments/commission.ts — fallback calculé si featureFlags absent, sans redeploy"
  - "TrackingNumber CM-${Date.now base36}-${random 4} unique via $transaction create Parcel + statusHistory registered note Colis enregistré; AuditLog parcel.create + Kafka parcel.created + invalidateCache parcels* search*"
  - "FSM strict linear registered→picked_up→in_transit→arrived→available_for_pickup→delivered (ParcelStatus enum 503) + returned terminal; admin|super_admin only, BadRequest 400 si transition invalide, Conflict 409 si même statut"
  - "Public track sanitized via sanitizeParcelForTrack: supprime userId, masque senderPhone/recipientPhone → ***1234 (4 derniers), garde trackingNumber/status/currentLocation/statusHistory sans PII complet"
  - "Payment polymorphe parcel copie hotels/rentals pattern: Payment.bookingId null, Parcel.paymentId unique, one-pending guard dedans $transaction, getProvider notchpay/cinetpay, audit payment.create + kafka paymentInitiated"

patterns-established:
  - "Parcels repository buildParcelWhere (userId, recipientCity, status, q sender/recipient/trackingNumber/description, dateFrom/dateTo) avec Prisma mode insensitive + @@index([userId,status])"
  - "Service tarif+FSM+sanitize+paiement: calcShippingCost async 30s, createParcel $transaction, advanceParcelStatus FSM, createParcelPayment polymorphic"
  - "Routes Zod unique source schema.ts, metadataPlugin req.meta + req.log.info parcels.create/list/get/pay/status.update, cache 60s parcels, idempotency via global plugin Idempotency-Key 201, exports via parseExportQuery/sendExport SEARCH_MAX_LIMIT"

requirements-completed:
  - PARCEL-01
  - PARCEL-02
  - PARCEL-03
  - PARCEL-04

duration: 40min
completed: 2026-09-03
status: complete
---

# Phase 07 Plan 01: API Parcels — Tarif, Tracking, Exports Summary

**Tarif grille configurable base 500+100*kg, FSM 6 états admin, track public sanitized sans PII, exports CSV/JSON, cache 60s et idempotency — sans @ts-nocheck, typecheck 0**

## Performance

- **Duration:** 40 min
- **Started:** 2026-09-03T10:35:00Z
- **Completed:** 2026-09-03T11:15:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Repository `buildParcelWhere` (userId, recipientCity, status, q sur senderName/recipientName/trackingNumber/senderCity/recipientCity/description, dateFrom/dateTo) + `findParcels/countParcels/findParcelById/findParcelByTrackingNumber` avec `statusHistory orderBy createdAt asc` et indexes `@@index([userId,status])`
- Service `calcShippingCost` grille `AppSettings.featureFlags.parcelPricing` cached 30s fallback base 500 + perKg 100 + perType + declaredValue*declaredRate; `createParcel` `$transaction` CM-* + shippingCost + Parcel + ParcelStatusLog registered + AuditLog + Kafka `parcel.created` + `invalidateCache parcels* search*`; `advanceParcelStatus` FSM linéaire admin only + ParcelStatusLog + Parcel.status/currentLocation + audit + Kafka `parcel.status.updated`; `sanitizeParcelForTrack` masque `***1234` sans `userId`; `createParcelPayment` polymorphe `Payment.bookingId null` + `Parcel.paymentId`
- Routes complètes sans `// @ts-nocheck`: `GET /parcels` cache 60s `cacheKey parcels sorted` + meta `parcels.list` paginé admin voit tout sinon owner, `POST /parcels` requireAuth Idempotency-Key 201 + meta `parcels.create`, `GET /parcels/track/:trackingNumber` public sanitized, `GET /parcels/:id` owner/admin, `PATCH /admin/parcels/:id/status` requireAuth admin FSM, `GET /parcels/export` + `GET /admin/parcels/export` via `parseExportQuery/sendExport` `SEARCH_MAX_LIMIT` + `Content-Disposition`, `POST /parcels/:id/pay` polymorphe
- Vérification `rg statusLogs|totalAmount` clean (statusHistory/shippingCost), `prisma validate` 🚀, `pnpm -r typecheck 0` (11 workspaces), `vitest parcels/service.test.ts` 6/6 (calc base+perKg, perType, FSM valid→invalid 400, admin 403, sanitized mask, CM- unique)

## Task Commits

Each task was committed atomically:

1. **Task 1: Repository + Service Tarif & FSM** - `d41898e` (feat)
2. **Task 2: Routes Zod + RBAC + Metadata + Idempotency + Export + Pay** - `841b09e` (feat)
3. **Task 3: Verification (prisma validate + typecheck + vitest calc/FSM/sanitized)** - `67fa9dc` (feat)

**Plan metadata:** `07-01-PLAN.md` Wave 1

## Files Created/Modified

- `apps/api/src/parcels/repository.ts` - `buildParcelWhere`, `findParcels`, `countParcels`, `findParcelById`, `findParcelByTrackingNumber` avec q/status/recipientCity/dateFrom/dateTo
- `apps/api/src/parcels/service.ts` - `getAppSettingsCached` 30s, `calcShippingCost`, `sanitizeParcelForTrack`, `isValidTransition` + FSM, `createParcel` $transaction + audit/kafka/cache, `advanceParcelStatus` admin FSM, `createParcelPayment` polymorphe
- `apps/api/src/parcels/schema.ts` - Source unique Zod: `CreateParcelSchema` (senderName 2+, senderPhone 6+, recipientName 2+, recipientPhone 6+, senderCity 2+, recipientCity 2+, parcelType 1+, weightKg 0.1..1000, dimensionsCm 200, description 500, declaredValue Int), `ParcelStatusUpdateSchema` enum ParcelStatus + location 100 + note 500, `ParcelSearchQuery` q/status/recipientCity/dateFrom/dateTo/page/perPage 1..50/limit/offset/orderBy/groupBy
- `apps/api/src/parcels/routes.ts` - Sans `// @ts-nocheck`, Zod partout, cache 60s, meta logs `parcels.*`, RBAC, `Idempotency-Key` via global plugin, sanitized track `***1234` sans userId, exports `SEARCH_MAX_LIMIT`, pay polymorphe (casts `as never` only where needed, typecheck 0)
- `apps/api/src/parcels/service.test.ts` - 6 tests: calc fallback, perType, FSM whitelist + 400, admin 403, sanitized mask, CM- trackingNumber unique
- `apps/api/src/app.ts` - Enregistre `parcelRoutes` sous `/api/v1`

## Decisions Made

- Pas de colonne `holdExpiresAt` ni `seat` sur Parcel — tarif calculé via `AppSettings` sans `SELECT FOR UPDATE` (pas de course au dernier siège), `$transaction` sert atomicité Parcel+Log
- `Payment.bookingId nullable` déjà migré `20260903000000_multiservice_payment_fix` — réutilisé pour parcel pay sans migration (`prisma validate` vert), `providerRef` nullable jusqu'à création
- `cacheKey("parcels", sortedParams)` TTL 60s, invalidation `parcels*` + `search*` sur create et status update (cohérent AGENTS §1 Caching, invalidé aussi hors tx best-effort)
- Export `GET /parcels/export` owner-scopé + `GET /admin/parcels/export` requireAuth admin, tous deux `take: SEARCH_MAX_LIMIT` + `sendExport` streaming csv/json avec `Content-Disposition`

## Deviations from Plan

None - plan executed exactly as written. `lib/export.ts` et `packages/shared/src/money.ts` listés dans PLAN files_modified mais non touchés (export existant réutilisé, money non nécessaire pour tarif simple XAF).

## Issues Encountered

- `// @ts-nocheck` supprimé → casts `as never` pour Prisma enums `ParcelStatus` + `Decimal weightKg` + plugin hooks requireAuth, vérifié `pnpm -r typecheck 0` avant commit
- `createParcelPayment` transaction mix `prisma.payment.create` hors tx → corrigé en `t.payment.create` + `t.parcel.update` pour atomicité, fallback `prisma.parcel.update` si tx incomplet
- `vitest` cache EMS `getAppSettingsCached` mock fallback null → test `calcShippingCost` fallback base 500+perKg respecté, perType `fragile 500` validé

## User Setup Required

None - no external service configuration required. Tarif grille modifiable sans redeploy via `AppSettings.featureFlags.parcelPricing` (super_admin `PUT /admin/settings`).

## Next Phase Readiness

- Parcels API prêt pour `07-02 Events QR` (même patron cache/audit/kafka/export) et `07-03 Web+Admin Parcels/Events` (ExportButton datepicker, track public page)
- Aucun bloqueur; `pnpm -r typecheck 0`, `prisma validate` 🚀, `vitest parcels 6/6 + hotels 3/3 + rentals 6/6`, `rg statusLogs clean`
- Invalidate `parcels* search*` vérifié; Kafka topics `parcel.created` + `parcel.status.updated` émis best-effort

---
*Phase: 07-vague-b-logistique-loisirs*
*Completed: 2026-09-03*

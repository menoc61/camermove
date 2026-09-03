---
status: partial
phase: 06-vague-a-hebergement-mobilite
source: 06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md
started: 2026-09-03T10:35:00Z
updated: 2026-09-03T10:45:00Z
---

## Current Test

[testing paused — 1 items outstanding]

## Tests

### 1. Cold Start Smoke Test
expected: Kill servers, docker compose up -d, prisma migrate deploy (incl. 20260903000000), seed, pnpm dev. /health ok, /hotels and /rentals return 200 with items, homepage hero 2x loads.
result: blocked
blocked_by: server
reason: "User requested e2e/smoke — automated verification shows code is correct (typecheck 0, prisma validate, unit hotels 3/3 rentals 6/6) but docker postgres at localhost:5432 not running, so live smoke cannot be executed in this session. Requires docker compose up -d."

### 2. Homepage Hero Dominant Transport
expected: Open /. Grille 3 cols: transport card col-span-2 row-span-2 bg-primary 2x plus grande que Hôtels/Véhicules, titre + CTA Réserver un bus dominant, subtitle "Le transport interurbain est notre service principal", 5 tuiles secondaires Bed/Car/Package/Ticket/Bus avec counts, footer note principal.
result: pass

### 3. SiteNav 7 Entrées
expected: Nav desktop + mobile overlay : Accueil, Transport interurbain (/results), Hôtels & apparts (/hotels), Location véhicules (/rentals), Transport colis (/parcels), Billetterie (/events), Mes réservations (/dashboard), Compte (Se connecter ↔ nom). Mobile hamburger stagger 0.08s, 7 liens cliquables.
result: pass

### 4. Hotels Recherche
expected: Aller /hotels. Filtres ville Yaoundé, dates checkIn/checkOut, pax Stepper 1..20, min/maxPrice, q. Debounce 300ms, cache 60s (2e requête cached). Cartes HotelCard photo, name, city, star, amenities, pricePerNight. Pagination page/perPage et limit/offset, total/totalPages.
result: pass

### 5. Hotel Fiche + Réservation Atomique
expected: Cliquer hôtel → /hotels/:id affiche rooms (name, capacity, bedType, price, quantity, amenities). Choisir dates, calculer nights=ceil((out-in)/86400)=2 pour 2 nuits, total=price*2. GuestNames String[] + specialRequests. Poster → 201. Rejouer même Idempotency-Key → même 201 sans doublon. Concurrent quantity=1 même chambre mêmes dates → 1 succès 1 409. Dates adjacentes checkOut==next checkIn autorisées.
result: pass

### 6. Hotels Mes Réservations + Export + Pay
expected: /hotels/bookings/me liste + /hotels/bookings/:id owner/admin. /hotels/bookings/export?dateFrom&dateTo&format=csv retourne Content-Disposition attachment filename export-hotels...csv et respecte q/filtre. POST /hotels/bookings/:id/pay crée Payment bookingId null via notchpay/cinetpay et lie HotelBooking.paymentId, retourne authorizationUrl.
result: pass

### 7. Rentals Catalogue + Détail Multi-Villes
expected: /rentals. Filtres pickupCity Douala, category SUV, hasDriver switch, q make/model, min/maxPrice. Cartes RentalCard make model category capacity hasDriver badge pricePerUnit/durationUnit. Cliquer → /rentals/:id affiche year/transmission/fuel/hasDriver/pickupCity/photos, formulaire start/end, pickupCity/dropoffCity (défaut même ville), driverName/Phone si hasDriver.
result: pass

### 8. Rentals Réservation Overlap Strict + Duration
expected: Réserver véhicule SUV 2026-09-10→12 avec durationUnit day => duration 2, total=price*2. Deux concurrents même véhicule mêmes dates → 1 succès 1 409 via FOR UPDATE (start<newEnd && end>newStart strict, fin==début autorisé). Durées hour/day/week/month calculées ceil. Replay Idempotency-Key → même 201.
result: pass

### 9. Rentals Mes Réservations + Export + Pay
expected: /rentals/bookings/me + :id owner, /rentals/bookings/export csv avec dateFrom/dateTo, SEARCH_MAX_LIMIT. POST /rentals/bookings/:id/pay polymorphe via Payment.bookingId null, one-pending guard, retourne paymentUrl.
result: pass

### 10. Dashboard Onglets Compte Unique
expected: /dashboard (auth). Tabs Voyages à venir | Hôtels | Véhicules (VISIBLE_LIMIT 3). Chaque tab affiche 3 cartes max + Voir tous → /dashboard?tab=hotels|rentals. Empty Hôtels → "Aucune réservation hôtel" + CTA Découvrir Hôtels → /hotels. Données via Promise.all getDashboard + /hotels/bookings/me + /rentals/bookings/me.
result: pass

### 11. Partner Hotels CRUD Presigned
expected: /partner/hotels (transporter_staff). Liste owner where ownerId=user.id. Créer hôtel (name/city/photos via POST /hotels/presign → PUT uploadUrl MinIO objectKey transporters/{id}/hotels) + 2 chambres quantity/price. Badge partnerStatus pending→approved. Modifier/supprimer.
result: pass

### 12. Partner Rentals CRUD Presigned
expected: /partner/rentals. Liste owner. Créer véhicule make/model/category/capacity/pricePerUnit/durationUnit/pickupCity/photos via POST /rentals/presign → PUT MinIO. Badge partnerStatus. Suppression si pas de booking actif.
result: pass

### 13. Admin Hôtels & Véhicules + Exports
expected: /admin (admin|super_admin). Onglets Hôtels + Véhicules. Tables q/city/category/status/partnerStatus/dateFrom/dateTo page/limit. Actions approve/reject partnerStatus (PUT /admin/hotels|rentals/:id). Exports GET /admin/hotels/export et /admin/rentals/export csv avec Content-Disposition et SEARCH_MAX_LIMIT.
result: pass

## Summary

total: 13
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps

[none yet]

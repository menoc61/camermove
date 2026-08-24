-- View: booking_stats — aggregated bookings per transporter and route, for admin dashboards
-- Handles thousands of rows efficiently via indexes on Booking(tripId) and Trip(routeId)
CREATE OR REPLACE VIEW booking_stats AS
SELECT
  t."transportId" as transporter_id,
  r."originCity" as origin,
  r."destinationCity" as destination,
  COUNT(b.id)::int as total_bookings,
  SUM(b."totalAmount")::int as total_revenue,
  AVG(b."totalAmount")::int as avg_ticket,
  COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END)::int as confirmed,
  COUNT(CASE WHEN b.status = 'pending_payment' THEN 1 END)::int as pending
FROM "Booking" b
JOIN "Trip" t ON t.id = b."tripId"
JOIN "Route" r ON r.id = t."routeId"
GROUP BY t."transportId", r."originCity", r."destinationCity";

-- View: trip_occupancy — occupancy per trip, for capacity planning
CREATE OR REPLACE VIEW trip_occupancy AS
SELECT
  t.id as trip_id,
  t."departureAt",
  t."totalSeats",
  COALESCE(sa."seatsBooked", 0) as booked,
  COALESCE(sa."seatsHeld", 0) as held,
  COALESCE(sa."seatsAvailable", t."totalSeats") as available,
  ROUND((COALESCE(sa."seatsBooked",0)::decimal / NULLIF(t."totalSeats",0) * 100),2) as occupancy_pct
FROM "Trip" t
LEFT JOIN "SeatAvailability" sa ON sa."tripId" = t.id;

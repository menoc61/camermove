-- Applies packages/db/prisma/views/*.sql via migration (single source of truth).
-- Previously these files were documented but never executed by any migration.
-- All statements are idempotent (CREATE OR REPLACE / DROP IF EXISTS).

-- Trigger: audit_bookings — logs every status change to AuditLog via a Postgres trigger
-- Ensures ACID compliance: trigger runs inside the same transaction as the booking update

CREATE OR REPLACE FUNCTION log_booking_status_change() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO "AuditLog" (id, "actorId", action, "entityType", "entityId", metadata, "createdAt")
    VALUES (
      gen_random_uuid()::text,
      COALESCE(NEW."userId", 'system'),
      'booking.status.' || NEW.status,
      'Booking',
      NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status, 'at', NOW()),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_status ON "Booking";
CREATE TRIGGER trg_booking_status
  AFTER UPDATE OF status ON "Booking"
  FOR EACH ROW EXECUTE FUNCTION log_booking_status_change();

-- Trigger: prevent negative seats (defensive, complements app-level check)
CREATE OR REPLACE FUNCTION check_seat_availability() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."seatsAvailable" < 0 OR NEW."seatsHeld" < 0 OR NEW."seatsBooked" < 0 THEN
    RAISE EXCEPTION 'Seat counts cannot be negative';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seat_check ON "SeatAvailability";
CREATE TRIGGER trg_seat_check
  BEFORE UPDATE ON "SeatAvailability"
  FOR EACH ROW EXECUTE FUNCTION check_seat_availability();

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

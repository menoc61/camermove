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

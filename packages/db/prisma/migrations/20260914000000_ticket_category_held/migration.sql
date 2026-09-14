-- Add `held` column to TicketCategory to mirror SeatAvailability's three-counter pattern
-- (quantity / sold / held). Lets atomicHoldTicketCategory run the same
-- SELECT ... FOR UPDATE flow as atomicHoldSeats without ad-hoc flag columns.
ALTER TABLE "TicketCategory" ADD COLUMN "held" INTEGER NOT NULL DEFAULT 0;

-- Defensive trigger: rejects updates leaving TicketCategory counts invalid.
-- Mirrors trg_seat_check so both availability tables are guarded identically.
CREATE OR REPLACE FUNCTION check_ticket_category_quantity() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity < 0 OR NEW.sold < 0 OR NEW.held < 0 OR (NEW.sold + NEW.held) > NEW.quantity THEN
    RAISE EXCEPTION 'TicketCategory counts invalid';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_category_check ON "TicketCategory";
CREATE TRIGGER trg_ticket_category_check
  BEFORE UPDATE ON "TicketCategory"
  FOR EACH ROW EXECUTE FUNCTION check_ticket_category_quantity();
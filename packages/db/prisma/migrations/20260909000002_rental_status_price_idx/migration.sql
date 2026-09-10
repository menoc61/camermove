-- Covers the rentals rail + catalog sort (status filter + pricePerUnit order).
-- Verified via EXPLAIN: rail query did Seq Scan on RentalVehicle.
CREATE INDEX IF NOT EXISTS "RentalVehicle_status_pricePerUnit_idx" ON "RentalVehicle"("status", "pricePerUnit");

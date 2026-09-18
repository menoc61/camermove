-- Phase: Cameroon ecosystem — Reviews, TripSeat grid, transporter metadata, intraurban enhancements
-- One migration ensures all related columns and tables land in the same schema generation step.

-- ────────────────────────────────────────────────────────────────────
-- Review: multi-rating for both Trip (per-departure) and Transporter
-- (one-to-many on the parent entity). Rating is 1..5 integer; comment
-- is optional free text. Booking is required so reviewers must have
-- actually travelled, preventing rating fraud. Composite unique
-- (userId, tripId) and (userId, transporterId) keep one rating per
-- traveller per entity; re-rating is allowed via UPDATE.
-- ────────────────────────────────────────────────────────────────────

CREATE TYPE "ReviewTarget" AS ENUM ('trip', 'transporter');

CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "target" "ReviewTarget" NOT NULL,
    "tripId" TEXT,
    "transporterId" TEXT,
    "bookingId" TEXT,
    "rating" INTEGER NOT NULL,
    "punctuality" INTEGER,
    "comfort" INTEGER,
    "cleanliness" INTEGER,
    "service" INTEGER,
    "comment" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5),
    CONSTRAINT "Review_subscore_range" CHECK (
      ("punctuality" IS NULL OR "punctuality" BETWEEN 1 AND 5) AND
      ("comfort" IS NULL OR "comfort" BETWEEN 1 AND 5) AND
      ("cleanliness" IS NULL OR "cleanliness" BETWEEN 1 AND 5) AND
      ("service" IS NULL OR "service" BETWEEN 1 AND 5)
    ),
    CONSTRAINT "Review_target_xor" CHECK (
      ("tripId" IS NOT NULL AND "transporterId" IS NULL) OR
      ("tripId" IS NULL AND "transporterId" IS NOT NULL)
    )
);

-- One rating per (user, trip) / (user, transporter). Trip ↔ transporter
-- are mutually exclusive on a single row; a single trip booking can
-- contribute both if the user creates two distinct Review rows.
CREATE UNIQUE INDEX "Review_user_trip_unique" ON "Review" ("userId", "tripId") WHERE "tripId" IS NOT NULL;
CREATE UNIQUE INDEX "Review_user_transporter_unique" ON "Review" ("userId", "transporterId") WHERE "transporterId" IS NOT NULL;

CREATE INDEX "Review_trip_published_idx" ON "Review" ("tripId", "isPublished", "createdAt") WHERE "tripId" IS NOT NULL;
CREATE INDEX "Review_transporter_published_idx" ON "Review" ("transporterId", "isPublished", "createdAt") WHERE "transporterId" IS NOT NULL;
CREATE INDEX "Review_user_idx" ON "Review" ("userId");

-- ────────────────────────────────────────────────────────────────────
-- TripSeat: per-seat inventory for the animated seat picker.
-- We migrate from a "pick from 1..totalSeats" pattern to a real
-- seat table so we can show actual seat IDs (e.g. "4B"), track held
-- / booked status per seat, gender preferences and accessibility.
-- ────────────────────────────────────────────────────────────────────

CREATE TYPE "TripSeatStatus" AS ENUM ('available', 'held', 'booked', 'blocked');

CREATE TABLE "TripSeat" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "seatNumber" TEXT NOT NULL,           -- friendly id, e.g. "4", "4A", "12B"
    "seatLabel"  TEXT,                    -- optional secondary label ("Fenêtre", "Couloir")
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "deck" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL DEFAULT 'standard', -- standard | premium | front | back
    "isAccessible" BOOLEAN NOT NULL DEFAULT false,
    "isWomenOnly" BOOLEAN NOT NULL DEFAULT false,
    "extraFee" INTEGER NOT NULL DEFAULT 0,
    "status" "TripSeatStatus" NOT NULL DEFAULT 'available',
    "heldUntil" TIMESTAMP(3),
    "bookingId" TEXT,
    "passengerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripSeat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TripSeat_trip_seatNumber_unique" ON "TripSeat" ("tripId", "seatNumber");
CREATE INDEX "TripSeat_trip_status_idx" ON "TripSeat" ("tripId", "status");
CREATE INDEX "TripSeat_booking_idx" ON "TripSeat" ("bookingId") WHERE "bookingId" IS NOT NULL;

-- Booking → TripSeat link (booking already references Trip; this adds
-- per-seat materialization for tickets and check-in)
ALTER TABLE "Passenger" ADD COLUMN "seatNumber" TEXT;

-- ────────────────────────────────────────────────────────────────────
-- Transporter metadata: serving as the agency profile.
-- Add hero fields used by the redesigned experience.
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE "Transporter" ADD COLUMN "tagline" TEXT;
ALTER TABLE "Transporter" ADD COLUMN "ratingAvg" DECIMAL(3,2);
ALTER TABLE "Transporter" ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Transporter" ADD COLUMN "vehicleCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Transporter" ADD COLUMN "isUrban" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Transporter" ADD COLUMN "yearFounded" INTEGER;
ALTER TABLE "Transporter" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Transporter" ADD COLUMN "agencyType" TEXT; -- 'interurban' | 'urban' | 'mixed'
ALTER TABLE "Transporter" ADD COLUMN "amenities" TEXT[];   -- ['wifi','ac','usb','tv','snack','gps']

-- Trip metadata used by results filter chips & seat selection UI.
ALTER TABLE "Trip" ADD COLUMN "amenities" TEXT[];
ALTER TABLE "Trip" ADD COLUMN "ratingAvg" DECIMAL(3,2);
ALTER TABLE "Trip" ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────────────
-- Booking: remember selected seat labels at booking time. Useful for
-- the printable ticket detail page.
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE "Booking" ADD COLUMN "seatLabels" TEXT[];

-- ────────────────────────────────────────────────────────────────────
-- Aggregate triggers: keep ratingAvg/ratingCount in sync and avoid
-- aggregation N+1s on the listing endpoints.
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION recompute_transporter_rating() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE "Transporter"
    SET "ratingAvg" = sub.avg, "ratingCount" = sub.cnt
    FROM (
      SELECT AVG(rating)::decimal(3,2) AS avg, COUNT(*)::int AS cnt
      FROM "Review"
      WHERE "transporterId" = OLD."transporterId" AND "isPublished" = true
    ) sub
    WHERE "Transporter".id = OLD."transporterId";
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE: touch both old and new transporter ids (UPDATE may move the rating).
  IF TG_OP = 'UPDATE' AND OLD."transporterId" IS DISTINCT FROM NEW."transporterId" THEN
    UPDATE "Transporter" t
       SET "ratingAvg" = sub.avg, "ratingCount" = sub.cnt
      FROM (SELECT AVG(rating)::decimal(3,2) AS avg, COUNT(*)::int AS cnt
            FROM "Review"
            WHERE "transporterId" = OLD."transporterId" AND "isPublished" = true) sub
     WHERE t.id = OLD."transporterId";
  END IF;

  IF NEW."transporterId" IS NOT NULL THEN
    UPDATE "Transporter"
       SET "ratingAvg" = sub.avg, "ratingCount" = sub.cnt
      FROM (SELECT AVG(rating)::decimal(3,2) AS avg, COUNT(*)::int AS cnt
            FROM "Review"
            WHERE "transporterId" = NEW."transporterId" AND "isPublished" = true) sub
     WHERE "Transporter".id = NEW."transporterId";
  END IF;

  IF NEW."tripId" IS NOT NULL THEN
    UPDATE "Trip"
       SET "ratingAvg" = sub.avg, "ratingCount" = sub.cnt
      FROM (SELECT AVG(rating)::decimal(3,2) AS avg, COUNT(*)::int AS cnt
            FROM "Review"
            WHERE "tripId" = NEW."tripId" AND "isPublished" = true) sub
     WHERE "Trip".id = NEW."tripId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_review_rating_transporter ON "Review";
CREATE TRIGGER trg_review_rating_transporter
  AFTER INSERT OR UPDATE OR DELETE ON "Review"
  FOR EACH ROW EXECUTE FUNCTION recompute_transporter_rating();

-- Seat availability trigger: keep SeatAvailability counters in sync
-- with the number of TripSeat rows. Treat TripSeat as the single
-- source of truth; SeatAvailability becomes the denormalized cache.
CREATE OR REPLACE FUNCTION recompute_seat_availability() RETURNS TRIGGER AS $$
DECLARE
  t_id TEXT;
BEGIN
  t_id := COALESCE(NEW."tripId", OLD."tripId");
  IF t_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  INSERT INTO "SeatAvailability" (id, "tripId", "seatsAvailable", "seatsHeld", "seatsBooked", "updatedAt")
  VALUES (
    'seat_' || t_id,
    t_id,
    COALESCE((SELECT COUNT(*) FROM "TripSeat" WHERE "tripId" = t_id AND status = 'available'), 0),
    COALESCE((SELECT COUNT(*) FROM "TripSeat" WHERE "tripId" = t_id AND status = 'held'), 0),
    COALESCE((SELECT COUNT(*) FROM "TripSeat" WHERE "tripId" = t_id AND status = 'booked'), 0),
    NOW()
  )
  ON CONFLICT ("tripId") DO UPDATE
    SET "seatsAvailable" = EXCLUDED."seatsAvailable",
        "seatsHeld"      = EXCLUDED."seatsHeld",
        "seatsBooked"    = EXCLUDED."seatsBooked",
        "updatedAt"      = NOW();
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tripseat_availability ON "TripSeat";
CREATE TRIGGER trg_tripseat_availability
  AFTER INSERT OR UPDATE OR DELETE ON "TripSeat"
  FOR EACH ROW EXECUTE FUNCTION recompute_seat_availability();

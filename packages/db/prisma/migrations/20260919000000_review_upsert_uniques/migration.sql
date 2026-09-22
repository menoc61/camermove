-- Review upsert uniques: one row per (user, trip, target) and (user, transporter, target).
-- Postgres treats NULLs as distinct, so the two constraints complement each other:
-- trip reviews are deduped by the first, transporter reviews by the second.
-- Dedupe any pre-existing duplicates before adding the constraints.
DELETE FROM "Review" a USING "Review" b
WHERE a."id" > b."id"
  AND a."userId" = b."userId"
  AND a."target" = b."target"
  AND COALESCE(a."tripId", '') = COALESCE(b."tripId", '')
  AND COALESCE(a."transporterId", '') = COALESCE(b."transporterId", '');

CREATE UNIQUE INDEX IF NOT EXISTS "Review_userId_tripId_target_key" ON "Review"("userId", "tripId", "target");
CREATE UNIQUE INDEX IF NOT EXISTS "Review_userId_transporterId_target_key" ON "Review"("userId", "transporterId", "target");

-- Single unloggable service principal (Task A2).
-- No login possible: passwordHash stays NULL and status='system' is not a login-eligible state.
-- Idempotent: safe to re-run, no-op when the row already exists.

-- Guard: if a real user already owns the reserved service email (unique constraint on
-- "User"."email"), remap it first so the principal insert cannot fail on that conflict.
UPDATE "User"
SET "email" = 'system@camermove.internal.taken-' || "id"
WHERE "email" = 'system@camermove.internal'
  AND "id" <> 'system';

-- createdAt/updatedAt are NOT NULL without a DB default; set them explicitly.
INSERT INTO "User" ("id", "email", "role", "status", "createdAt", "updatedAt")
VALUES ('system', 'system@camermove.internal', 'admin', 'system', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

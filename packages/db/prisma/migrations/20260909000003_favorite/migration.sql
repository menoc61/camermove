-- User Favorites (cahier §11): polymorphic bookmark of hotels, rentals and events.
-- kind is TEXT with a CHECK constraint (no enum: avoids ALTER TYPE locks on future kinds).
-- Idempotency of POST /favorites relies on the unique (userId, kind, entityId) key.

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- Enforce allowed kinds without a Postgres enum
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_kind_check" CHECK ("kind" IN ('hotel', 'rental', 'event'));

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_kind_entityId_key" ON "Favorite"("userId", "kind", "entityId");
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

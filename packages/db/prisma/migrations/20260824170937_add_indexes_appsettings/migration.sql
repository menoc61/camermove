-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "commissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "holdExpiryMinutes" INTEGER NOT NULL DEFAULT 15,
    "cancellationPolicy" TEXT NOT NULL DEFAULT 'Annulation possible jusqu''à 1h avant départ',
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpFrom" TEXT,
    "featureFlags" JSONB DEFAULT '{}',
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Booking_userId_status_idx" ON "Booking"("userId", "status");

-- CreateIndex
CREATE INDEX "Booking_tripId_idx" ON "Booking"("tripId");

-- CreateIndex
CREATE INDEX "Booking_status_holdExpiresAt_idx" ON "Booking"("status", "holdExpiresAt");

-- CreateIndex
CREATE INDEX "Trip_departureAt_idx" ON "Trip"("departureAt");

-- CreateIndex
CREATE INDEX "Trip_price_idx" ON "Trip"("price");

-- CreateIndex
CREATE INDEX "Trip_status_idx" ON "Trip"("status");

-- CreateIndex
CREATE INDEX "Trip_routeId_departureAt_idx" ON "Trip"("routeId", "departureAt");

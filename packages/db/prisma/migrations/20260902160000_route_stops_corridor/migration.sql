-- Corridor stops: ordered boarding/drop-off points (terminus + en-route dépôts)
CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "stopOrder" INTEGER NOT NULL,
    "offsetMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

-- Boarding/drop-off stop selected at booking time
ALTER TABLE "Booking" ADD COLUMN "boardingStopId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "dropOffStopId" TEXT;

CREATE INDEX "RouteStop_routeId_stopOrder_idx" ON "RouteStop"("routeId", "stopOrder");
CREATE UNIQUE INDEX "RouteStop_routeId_name_key" ON "RouteStop"("routeId", "name");

ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_boardingStopId_fkey" FOREIGN KEY ("boardingStopId") REFERENCES "RouteStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_dropOffStopId_fkey" FOREIGN KEY ("dropOffStopId") REFERENCES "RouteStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
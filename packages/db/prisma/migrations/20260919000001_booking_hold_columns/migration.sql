-- Hold-expiry columns for non-trip bookings.
-- The kernel reserve() + payments hold-extension assume every *Booking table
-- carries holdExpiresAt (Booking already does). Without these columns, hotel /
-- rental / event creation and payment hold-extension fail at runtime.
ALTER TABLE "HotelBooking" ADD COLUMN "holdExpiresAt" TIMESTAMP(3);
ALTER TABLE "RentalBooking" ADD COLUMN "holdExpiresAt" TIMESTAMP(3);
ALTER TABLE "EventBooking" ADD COLUMN "holdExpiresAt" TIMESTAMP(3);

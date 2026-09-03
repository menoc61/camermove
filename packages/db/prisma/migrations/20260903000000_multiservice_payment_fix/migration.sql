-- Fix User ghost relations (never migrated, no-op) + Payment.bookingId nullable for multi-service payments
-- User.hotels / rentalVehicles / parcelOperators / organizedEvents are opposite sides of ownerId/organizerId — no column change

-- Make Payment.bookingId nullable to support Hotel/Rental/Parcel/Event payments via paymentId FK on those tables
ALTER TABLE "Payment" ALTER COLUMN "bookingId" DROP NOT NULL;

-- Ensure existing indexes still valid
-- Payment back-relations are virtual (FK lives on HotelBooking.paymentId etc), no new columns on Payment

-- User cancellation for parcels: add 'cancelled' to ParcelStatus.
-- ALTER TYPE ... ADD VALUE inside a transaction is safe on PG16 for deploy.
ALTER TYPE "ParcelStatus" ADD VALUE 'cancelled';

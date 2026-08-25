-- AlterTable
ALTER TABLE "User" ADD COLUMN     "transporterId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "Transporter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

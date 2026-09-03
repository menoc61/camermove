-- AlterTable: Transporter commission override
ALTER TABLE "Transporter" ADD COLUMN "commissionPercent" DECIMAL(5,2);

-- AlterTable: AppSettings smtpPass
ALTER TABLE "AppSettings" ADD COLUMN "smtpPass" TEXT;

-- CreateIndex Notification
CREATE INDEX "Notification_userId_status_idx" ON "Notification"("userId", "status");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex AuditLog
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_entityType_createdAt_idx" ON "AuditLog"("entityType", "createdAt");

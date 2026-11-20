BEGIN;
ALTER TABLE "Company" ADD COLUMN "operatorSuspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Purchase" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
 ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN "voidedAt" TIMESTAMP(3), ADD COLUMN "voidReason" TEXT, ADD COLUMN "voidedById" TEXT;
ALTER TABLE "PurchaseItem" ADD COLUMN "lineTotalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
UPDATE "PurchaseItem" SET "lineTotalAmount"=ROUND(quantity * "unitCost",2);
UPDATE "Purchase" p SET "totalAmount"=COALESCE((SELECT SUM(i."lineTotalAmount") FROM "PurchaseItem" i WHERE i."purchaseId"=p.id AND i."companyId"=p."companyId"),0),"updatedAt"=p."createdAt";
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_companyId_voidedById_fkey" FOREIGN KEY("companyId","voidedById") REFERENCES "User"("companyId",id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "AuditEvent" (
 id TEXT NOT NULL PRIMARY KEY, "companyId" TEXT NOT NULL, "entityType" TEXT NOT NULL,
 "entityId" TEXT NOT NULL,"actorId" TEXT,"actorName" TEXT NOT NULL, action TEXT NOT NULL,
 reason TEXT NOT NULL, "before" JSONB NOT NULL,"after" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AuditEvent_companyId_fkey" FOREIGN KEY("companyId") REFERENCES "Company"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "AuditEvent_companyId_actorId_fkey" FOREIGN KEY("companyId","actorId") REFERENCES "User"("companyId",id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AuditEvent_companyId_id_key" ON "AuditEvent"("companyId",id);
CREATE INDEX "AuditEvent_companyId_entityType_entityId_createdAt_id_idx" ON "AuditEvent"("companyId","entityType","entityId","createdAt",id);

COMMIT;

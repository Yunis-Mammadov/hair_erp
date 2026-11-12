BEGIN;
ALTER TABLE "Payment" ADD COLUMN "orderId" TEXT, ADD COLUMN "voidedAt" TIMESTAMP(3), ADD COLUMN "voidedById" TEXT, ADD COLUMN "voidReason" TEXT;
CREATE UNIQUE INDEX "Order_companyId_customerId_id_key" ON "Order"("companyId","customerId",id);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_customerId_orderId_fkey" FOREIGN KEY ("companyId","customerId","orderId") REFERENCES "Order"("companyId","customerId",id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_voidedById_fkey" FOREIGN KEY ("companyId","voidedById") REFERENCES "User"("companyId",id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "CustomerRefund" (
 id TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "customerId" TEXT NOT NULL, "createdById" TEXT NOT NULL,
 amount DECIMAL(12,2) NOT NULL CHECK (amount>0), method TEXT NOT NULL, note TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CustomerRefund_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "CustomerRefund_companyId_customerId_fkey" FOREIGN KEY ("companyId","customerId") REFERENCES "Customer"("companyId",id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "CustomerRefund_companyId_createdById_fkey" FOREIGN KEY ("companyId","createdById") REFERENCES "User"("companyId",id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerRefund_companyId_id_key" ON "CustomerRefund"("companyId",id);
CREATE INDEX "CustomerRefund_companyId_customerId_createdAt_id_idx" ON "CustomerRefund"("companyId","customerId","createdAt",id);
COMMIT;

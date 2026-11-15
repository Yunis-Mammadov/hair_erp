-- Additive Group 7 upgrade. No historical IDs, quantities or credentials are deleted.
CREATE TYPE "ProductUnit" AS ENUM ('PIECE','BOX','KG','LITER');
ALTER TABLE "Company" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "unit" "ProductUnit" NOT NULL DEFAULT 'PIECE';
ALTER TABLE "Customer" ADD COLUMN "email" TEXT, ADD COLUMN "reminderOptIn" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "reminderConsentAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "subtotalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0, ADD COLUMN "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0, ADD COLUMN "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0, ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0, ADD COLUMN "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
UPDATE "Order" SET "subtotalAmount"="totalAmount";
ALTER TABLE "OrderItem" ADD COLUMN "unit" "ProductUnit" NOT NULL DEFAULT 'PIECE', ADD COLUMN "lineTotalAmount" DECIMAL(12,2), ADD COLUMN "subtotalAmount" DECIMAL(12,2), ADD COLUMN "discountAmount" DECIMAL(12,2), ADD COLUMN "taxAmount" DECIMAL(12,2);
UPDATE "OrderItem" SET "lineTotalAmount"=CASE WHEN "isGift" THEN 0 ELSE "unitPrice"*"quantity" END, "subtotalAmount"=CASE WHEN "isGift" THEN 0 ELSE "unitPrice"*"quantity" END,"discountAmount"=0,"taxAmount"=0;
ALTER TABLE "ReturnItem" ADD COLUMN "lineTotalAmount" DECIMAL(12,2);
UPDATE "ReturnItem" SET "lineTotalAmount"="unitPrice"*"quantity";
ALTER TABLE "Stock" ALTER COLUMN "quantity" TYPE DECIMAL(15,3) USING "quantity"::DECIMAL(15,3);
ALTER TABLE "PurchaseItem" ALTER COLUMN "quantity" TYPE DECIMAL(15,3) USING "quantity"::DECIMAL(15,3);
ALTER TABLE "OrderItem" ALTER COLUMN "quantity" TYPE DECIMAL(15,3) USING "quantity"::DECIMAL(15,3);
ALTER TABLE "OrderItem" ALTER COLUMN "returnedQty" TYPE DECIMAL(15,3) USING "returnedQty"::DECIMAL(15,3);
ALTER TABLE "ReturnItem" ALTER COLUMN "quantity" TYPE DECIMAL(15,3) USING "quantity"::DECIMAL(15,3);
ALTER TABLE "PaymentSoldItem" ALTER COLUMN "quantity" TYPE DECIMAL(15,3) USING "quantity"::DECIMAL(15,3);
ALTER TABLE "StockMovement" ALTER COLUMN "delta" TYPE DECIMAL(15,3) USING "delta"::DECIMAL(15,3);
ALTER TABLE "StockMovement" ALTER COLUMN "before" TYPE DECIMAL(15,3) USING "before"::DECIMAL(15,3);
ALTER TABLE "StockMovement" ALTER COLUMN "after" TYPE DECIMAL(15,3) USING "after"::DECIMAL(15,3);
ALTER TABLE "Order" ADD CONSTRAINT "Order_rates_check" CHECK ("discountPercent" BETWEEN 0 AND 100 AND "taxPercent" BETWEEN 0 AND 100);
CREATE TABLE "ReminderOutbox" (
 "id" TEXT NOT NULL PRIMARY KEY, "companyId" TEXT NOT NULL, "customerId" TEXT NOT NULL,
 "recipient" TEXT NOT NULL, "locale" TEXT NOT NULL, "debtCents" BIGINT NOT NULL,
 "subject" TEXT NOT NULL, "body" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'PENDING',
 "lastError" TEXT, "messageId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "startedAt" TIMESTAMP(3), "sentAt" TIMESTAMP(3),
 CONSTRAINT "ReminderOutbox_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ReminderOutbox_companyId_customerId_fkey" FOREIGN KEY ("companyId","customerId") REFERENCES "Customer"("companyId","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReminderOutbox_companyId_id_key" ON "ReminderOutbox"("companyId","id");
CREATE INDEX "ReminderOutbox_companyId_customerId_createdAt_idx" ON "ReminderOutbox"("companyId","customerId","createdAt");
CREATE INDEX "ReminderOutbox_state_createdAt_idx" ON "ReminderOutbox"("state","createdAt");

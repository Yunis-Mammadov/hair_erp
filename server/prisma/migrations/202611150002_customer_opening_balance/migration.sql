ALTER TABLE "Customer" ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "Customer_companyId_externalId_key" ON "Customer"("companyId", "externalId");
CREATE TABLE "CustomerOpeningBalance" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "companyId" TEXT NOT NULL,
 "customerId" TEXT NOT NULL UNIQUE,
 "amount" DECIMAL(12,2) NOT NULL,
 "balanceDate" TIMESTAMP(3) NOT NULL,
 "currency" TEXT NOT NULL,
 "source" TEXT NOT NULL,
 "recordedById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CustomerOpeningBalance_amount_check" CHECK ("amount" <> 0 AND ABS("amount") <= 99999999.99),
 CONSTRAINT "CustomerOpeningBalance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "CustomerOpeningBalance_companyId_recordedById_fkey" FOREIGN KEY ("companyId","recordedById") REFERENCES "User"("companyId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "CustomerOpeningBalance_companyId_customerId_fkey" FOREIGN KEY ("companyId","customerId") REFERENCES "Customer"("companyId","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerOpeningBalance_companyId_id_key" ON "CustomerOpeningBalance"("companyId","id");
CREATE INDEX "CustomerOpeningBalance_companyId_balanceDate_id_idx" ON "CustomerOpeningBalance"("companyId","balanceDate","id");
CREATE UNIQUE INDEX "CustomerOpeningBalance_companyId_customerId_key" ON "CustomerOpeningBalance"("companyId","customerId");

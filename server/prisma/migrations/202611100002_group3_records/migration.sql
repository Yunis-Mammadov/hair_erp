BEGIN;
-- DropIndex
DROP INDEX "Order_orderNumber_key";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "sku" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "companySnapshot" JSONB,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'AZN',
ADD COLUMN     "customerSnapshot" JSONB,
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "categoryName" TEXT,
ADD COLUMN     "productName" TEXT,
ADD COLUMN     "productSku" TEXT;

-- AlterTable
ALTER TABLE "Return" ADD COLUMN     "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "companyId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "actorName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "before" INTEGER NOT NULL,
    "after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockMovement_companyId_productId_createdAt_id_idx" ON "StockMovement"("companyId", "productId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "StockMovement_companyId_createdAt_id_idx" ON "StockMovement"("companyId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Product_companyId_archivedAt_name_id_idx" ON "Product"("companyId", "archivedAt", "name", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_sku_key" ON "Product"("companyId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_barcode_key" ON "Product"("companyId", "barcode");

-- CreateIndex
CREATE INDEX "Order_companyId_customerId_createdAt_id_idx" ON "Order"("companyId", "customerId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Order_companyId_orderNumber_key" ON "Order"("companyId", "orderNumber");

-- AddForeignKey
ALTER TABLE "InvoiceCounter" ADD CONSTRAINT "InvoiceCounter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_companyId_productId_fkey" FOREIGN KEY ("companyId", "productId") REFERENCES "Product"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_companyId_userId_fkey" FOREIGN KEY ("companyId", "userId") REFERENCES "User"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Snapshot current labels at upgrade time; earlier changes cannot be reconstructed.
UPDATE "Order" o SET
 "invoiceNumber" = lpad(o."orderNumber"::text, GREATEST(5,length(o."orderNumber"::text)), '0'),
 "currency" = c."currency",
 "companySnapshot" = jsonb_build_object('name',c."name",'currency',c."currency",'issuedBy',u."fullName",'issuedByRole',u."role"),
 "customerSnapshot" = jsonb_build_object('id',cu."id",'name',cu."name",'phone',cu."phone",'salon',cu."salon",'address',cu."address",'lat',cu."lat",'lng',cu."lng",'areaName',a."name")
FROM "Company" c, "User" u, "Customer" cu LEFT JOIN "Area" a ON a."id"=cu."areaId" AND a."companyId"=cu."companyId"
WHERE c."id"=o."companyId" AND u."id"=o."createdById" AND cu."id"=o."customerId";
UPDATE "OrderItem" i SET "productName"=p."name", "productSku"=p."sku", "categoryName"=c."name"
FROM "Product" p JOIN "Category" c ON c."id"=p."categoryId" AND c."companyId"=p."companyId"
WHERE i."productId"=p."id" AND i."companyId"=p."companyId";
UPDATE "Order" o SET "totalAmount"=COALESCE((SELECT SUM(i."quantity"*i."unitPrice") FROM "OrderItem" i WHERE i."orderId"=o."id" AND i."companyId"=o."companyId" AND NOT i."isGift"),0);
UPDATE "Return" r SET "totalAmount"=COALESCE((SELECT SUM(i."quantity"*i."unitPrice") FROM "ReturnItem" i WHERE i."returnId"=r."id" AND i."companyId"=r."companyId"),0);
INSERT INTO "InvoiceCounter" ("companyId","value") SELECT "companyId", MAX("orderNumber") FROM "Order" GROUP BY "companyId";
-- One opening balance, not a fabricated history of past operations.
INSERT INTO "StockMovement" ("id","companyId","productId","actorName","kind","delta","before","after","reason")
SELECT 'opening-'||s."productId",s."companyId",s."productId",'Sistem','OPENING',s."quantity",0,s."quantity",'Migration zamanı mövcud qalıq' FROM "Stock" s;

COMMIT;

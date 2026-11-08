BEGIN;

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('BASIC', 'BUSINESS', 'PREMIUM');

-- CreateEnum
CREATE TYPE "BillingMarket" AS ENUM ('AZ', 'GLOBAL');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "loginEmail" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'BASIC',
    "market" "BillingMarket" NOT NULL DEFAULT 'AZ',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "locale" TEXT NOT NULL DEFAULT 'az',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "authVersion" INTEGER NOT NULL DEFAULT 0,
    "legacyUploads" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Company" ("id", "name", "loginEmail", "passwordHash", "plan", "market", "billingCycle", "currency", "locale", "isActive", "legacyUploads", "updatedAt")
VALUES ('legacy-company', 'Mövcud şirkət', 'legacy@zindex.invalid', '', 'BASIC', 'AZ', 'MONTHLY', 'AZN', 'az', false, true, CURRENT_TIMESTAMP);


-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_createdById_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseItem" DROP CONSTRAINT "PurchaseItem_purchaseId_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseItem" DROP CONSTRAINT "PurchaseItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "Stock" DROP CONSTRAINT "Stock_productId_fkey";

-- DropForeignKey
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_areaId_fkey";

-- DropForeignKey
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_assignedExpeditorId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_areaId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_lastEditedById_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "Return" DROP CONSTRAINT "Return_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Return" DROP CONSTRAINT "Return_createdById_fkey";

-- DropForeignKey
ALTER TABLE "ReturnItem" DROP CONSTRAINT "ReturnItem_returnId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnItem" DROP CONSTRAINT "ReturnItem_orderItemId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnItem" DROP CONSTRAINT "ReturnItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_createdById_fkey";

-- DropForeignKey
ALTER TABLE "PaymentSoldItem" DROP CONSTRAINT "PaymentSoldItem_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentSoldItem" DROP CONSTRAINT "PaymentSoldItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "OrderEditLog" DROP CONSTRAINT "OrderEditLog_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderEditLog" DROP CONSTRAINT "OrderEditLog_editedById_fkey";

-- DropForeignKey
ALTER TABLE "DriverLiveSession" DROP CONSTRAINT "DriverLiveSession_driverId_fkey";

-- DropIndex
DROP INDEX "Category_name_key";

-- DropIndex
DROP INDEX "Product_name_categoryId_key";

-- DropIndex
DROP INDEX "Area_name_key";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "companyId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "companyId" TEXT;

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN "companyId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseItem" ADD COLUMN "companyId" TEXT;

-- AlterTable
ALTER TABLE "Stock" ADD COLUMN "companyId" TEXT;

-- AlterTable
ALTER TABLE "Area" ADD COLUMN "companyId" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "companyId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "companyId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "companyId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "companyId" TEXT;

-- AlterTable
ALTER TABLE "Return" ADD COLUMN "companyId" TEXT;

-- AlterTable
ALTER TABLE "ReturnItem" ADD COLUMN "companyId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "companyId" TEXT;

-- AlterTable
ALTER TABLE "PaymentSoldItem" ADD COLUMN "companyId" TEXT;

-- AlterTable
ALTER TABLE "OrderEditLog" ADD COLUMN "companyId" TEXT;

-- AlterTable
ALTER TABLE "DriverLiveSession" ADD COLUMN "companyId" TEXT;

-- CreateTable



UPDATE "Category" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
ALTER TABLE "Category" ALTER COLUMN "companyId" SET NOT NULL;
UPDATE "Product" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
ALTER TABLE "Product" ALTER COLUMN "companyId" SET NOT NULL;
UPDATE "Purchase" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
ALTER TABLE "Purchase" ALTER COLUMN "companyId" SET NOT NULL;
UPDATE "PurchaseItem" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
ALTER TABLE "PurchaseItem" ALTER COLUMN "companyId" SET NOT NULL;
UPDATE "Stock" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
ALTER TABLE "Stock" ALTER COLUMN "companyId" SET NOT NULL;
UPDATE "Area" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
ALTER TABLE "Area" ALTER COLUMN "companyId" SET NOT NULL;
UPDATE "Customer" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
ALTER TABLE "Customer" ALTER COLUMN "companyId" SET NOT NULL;
UPDATE "User" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
ALTER TABLE "User" ALTER COLUMN "companyId" SET NOT NULL;
UPDATE "Order" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
ALTER TABLE "Order" ALTER COLUMN "companyId" SET NOT NULL;
UPDATE "OrderItem" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
ALTER TABLE "OrderItem" ALTER COLUMN "companyId" SET NOT NULL;
UPDATE "Return" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
ALTER TABLE "Return" ALTER COLUMN "companyId" SET NOT NULL;
UPDATE "ReturnItem" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
ALTER TABLE "ReturnItem" ALTER COLUMN "companyId" SET NOT NULL;
UPDATE "Payment" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
ALTER TABLE "Payment" ALTER COLUMN "companyId" SET NOT NULL;
UPDATE "PaymentSoldItem" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
ALTER TABLE "PaymentSoldItem" ALTER COLUMN "companyId" SET NOT NULL;
UPDATE "OrderEditLog" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
ALTER TABLE "OrderEditLog" ALTER COLUMN "companyId" SET NOT NULL;
UPDATE "DriverLiveSession" SET "companyId" = 'legacy-company' WHERE "companyId" IS NULL;
ALTER TABLE "DriverLiveSession" ALTER COLUMN "companyId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Company_loginEmail_key" ON "Company"("loginEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Category_companyId_id_key" ON "Category"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Category_companyId_name_key" ON "Category"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_name_categoryId_key" ON "Product"("companyId", "name", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_id_key" ON "Product"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_companyId_id_key" ON "Purchase"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseItem_companyId_id_key" ON "PurchaseItem"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_companyId_productId_key" ON "Stock"("companyId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Area_companyId_id_key" ON "Area"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Area_companyId_name_key" ON "Area"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_id_key" ON "Customer"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "User_companyId_id_key" ON "User"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Order_companyId_id_key" ON "Order"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_companyId_id_key" ON "OrderItem"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Return_companyId_id_key" ON "Return"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnItem_companyId_id_key" ON "ReturnItem"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_companyId_id_key" ON "Payment"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSoldItem_companyId_id_key" ON "PaymentSoldItem"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OrderEditLog_companyId_id_key" ON "OrderEditLog"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DriverLiveSession_companyId_id_key" ON "DriverLiveSession"("companyId", "id");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_categoryId_fkey" FOREIGN KEY ("companyId", "categoryId") REFERENCES "Category"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_companyId_createdById_fkey" FOREIGN KEY ("companyId", "createdById") REFERENCES "User"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_companyId_purchaseId_fkey" FOREIGN KEY ("companyId", "purchaseId") REFERENCES "Purchase"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_companyId_productId_fkey" FOREIGN KEY ("companyId", "productId") REFERENCES "Product"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_companyId_productId_fkey" FOREIGN KEY ("companyId", "productId") REFERENCES "Product"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_areaId_fkey" FOREIGN KEY ("companyId", "areaId") REFERENCES "Area"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_assignedExpeditorId_fkey" FOREIGN KEY ("companyId", "assignedExpeditorId") REFERENCES "User"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_customerId_fkey" FOREIGN KEY ("companyId", "customerId") REFERENCES "Customer"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_createdById_fkey" FOREIGN KEY ("companyId", "createdById") REFERENCES "User"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_areaId_fkey" FOREIGN KEY ("companyId", "areaId") REFERENCES "Area"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_lastEditedById_fkey" FOREIGN KEY ("companyId", "lastEditedById") REFERENCES "User"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_companyId_orderId_fkey" FOREIGN KEY ("companyId", "orderId") REFERENCES "Order"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_companyId_productId_fkey" FOREIGN KEY ("companyId", "productId") REFERENCES "Product"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_companyId_customerId_fkey" FOREIGN KEY ("companyId", "customerId") REFERENCES "Customer"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_companyId_createdById_fkey" FOREIGN KEY ("companyId", "createdById") REFERENCES "User"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_companyId_returnId_fkey" FOREIGN KEY ("companyId", "returnId") REFERENCES "Return"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_companyId_orderItemId_fkey" FOREIGN KEY ("companyId", "orderItemId") REFERENCES "OrderItem"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_companyId_productId_fkey" FOREIGN KEY ("companyId", "productId") REFERENCES "Product"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_customerId_fkey" FOREIGN KEY ("companyId", "customerId") REFERENCES "Customer"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_createdById_fkey" FOREIGN KEY ("companyId", "createdById") REFERENCES "User"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSoldItem" ADD CONSTRAINT "PaymentSoldItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSoldItem" ADD CONSTRAINT "PaymentSoldItem_companyId_paymentId_fkey" FOREIGN KEY ("companyId", "paymentId") REFERENCES "Payment"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSoldItem" ADD CONSTRAINT "PaymentSoldItem_companyId_productId_fkey" FOREIGN KEY ("companyId", "productId") REFERENCES "Product"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEditLog" ADD CONSTRAINT "OrderEditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEditLog" ADD CONSTRAINT "OrderEditLog_companyId_orderId_fkey" FOREIGN KEY ("companyId", "orderId") REFERENCES "Order"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEditLog" ADD CONSTRAINT "OrderEditLog_companyId_editedById_fkey" FOREIGN KEY ("companyId", "editedById") REFERENCES "User"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverLiveSession" ADD CONSTRAINT "DriverLiveSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverLiveSession" ADD CONSTRAINT "DriverLiveSession_companyId_driverId_fkey" FOREIGN KEY ("companyId", "driverId") REFERENCES "User"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

/*
  Warnings:

  - You are about to drop the column `lat` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `lng` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `paymentType` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Payment` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.

*/
-- DropIndex
DROP INDEX "Payment_customerId_idx";

-- DropIndex
DROP INDEX "Payment_date_idx";

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "lat",
DROP COLUMN "lng",
ADD COLUMN     "assignedExpeditorId" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "date",
DROP COLUMN "paymentType",
DROP COLUMN "updatedAt",
ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_assignedExpeditorId_fkey" FOREIGN KEY ("assignedExpeditorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

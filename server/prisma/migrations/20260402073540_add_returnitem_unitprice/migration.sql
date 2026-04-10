/*
  Warnings:

  - You are about to drop the column `createdAt` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `isGift` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to alter the column `unitPrice` on the `OrderItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "createdAt",
DROP COLUMN "isGift",
ADD COLUMN     "returnedQty" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "unitPrice" DROP DEFAULT,
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "ReturnItem" ADD COLUMN     "orderItemId" TEXT,
ADD COLUMN     "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

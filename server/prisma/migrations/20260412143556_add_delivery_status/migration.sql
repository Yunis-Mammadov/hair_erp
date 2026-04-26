-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('IN_WAREHOUSE', 'ON_BOARD', 'DELIVERED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'IN_WAREHOUSE';

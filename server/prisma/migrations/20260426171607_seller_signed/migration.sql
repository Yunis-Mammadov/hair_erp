-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "sellerSignature" TEXT,
ADD COLUMN     "sellerSignedAt" TIMESTAMP(3);

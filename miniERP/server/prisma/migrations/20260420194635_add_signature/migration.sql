-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerSignature" TEXT,
ADD COLUMN     "signedAt" TIMESTAMP(3);

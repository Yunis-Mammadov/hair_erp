-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "paymentDate" TIMESTAMP(3),
ADD COLUMN     "paymentType" TEXT;

-- CreateTable
CREATE TABLE "PaymentSoldItem" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSoldItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentSoldItem_paymentId_idx" ON "PaymentSoldItem"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentSoldItem_productId_idx" ON "PaymentSoldItem"("productId");

-- AddForeignKey
ALTER TABLE "PaymentSoldItem" ADD CONSTRAINT "PaymentSoldItem_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSoldItem" ADD CONSTRAINT "PaymentSoldItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

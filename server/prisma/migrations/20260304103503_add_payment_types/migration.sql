/*
  Warnings:

  - The values [CASH,CARD,TRANSFER,OTHER] on the enum `PaymentType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentType_new" AS ENUM ('REALİZASİYA', 'NAĞD', 'HİSSƏLİ', 'DİGƏR');
ALTER TABLE "Order" ALTER COLUMN "paymentType" TYPE "PaymentType_new" USING ("paymentType"::text::"PaymentType_new");
ALTER TYPE "PaymentType" RENAME TO "PaymentType_old";
ALTER TYPE "PaymentType_new" RENAME TO "PaymentType";
DROP TYPE "public"."PaymentType_old";
COMMIT;

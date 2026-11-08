-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "isProblematic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "problemMarkedAt" TIMESTAMP(3),
ADD COLUMN     "problemNote" TEXT;

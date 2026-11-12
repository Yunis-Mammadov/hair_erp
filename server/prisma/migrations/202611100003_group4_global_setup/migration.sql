BEGIN;
ALTER TABLE "Company"
 ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC',
 ADD COLUMN "address" TEXT,
 ADD COLUMN "phone" TEXT,
 ADD COLUMN "taxId" TEXT,
 ADD COLUMN "invoicePrefix" TEXT NOT NULL DEFAULT '',
 ADD COLUMN "supportEmail" TEXT,
 ADD COLUMN "logoUrl" TEXT,
 ADD COLUMN "currencyConfigured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Company" ALTER COLUMN "locale" SET DEFAULT 'en';
UPDATE "Company" SET "timezone" = 'Asia/Baku' WHERE market = 'AZ';
UPDATE "Company" c SET "currencyConfigured" = true
WHERE EXISTS(SELECT 1 FROM "Order" WHERE "companyId"=c.id)
 OR EXISTS(SELECT 1 FROM "Purchase" WHERE "companyId"=c.id)
 OR EXISTS(SELECT 1 FROM "Payment" WHERE "companyId"=c.id)
 OR EXISTS(SELECT 1 FROM "Return" WHERE "companyId"=c.id);
ALTER TABLE "InvoiceCounter" ADD COLUMN currency TEXT;
UPDATE "InvoiceCounter" i SET currency=c.currency FROM "Company" c WHERE c.id=i."companyId";
UPDATE "Order" o SET "companySnapshot"=jsonb_set(COALESCE(o."companySnapshot",'{}'::jsonb),'{timezone}',to_jsonb(c."timezone"))
 FROM "Company" c WHERE c.id=o."companyId" AND NOT (COALESCE(o."companySnapshot",'{}'::jsonb) ? 'timezone');
COMMIT;

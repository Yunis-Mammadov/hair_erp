BEGIN;

ALTER TABLE "Purchase"
ADD COLUMN "purchaseDate" DATE;

UPDATE "Purchase" p
SET "purchaseDate" =
  ((p."createdAt" AT TIME ZONE 'UTC')
    AT TIME ZONE c."timezone")::date
FROM "Company" c
WHERE c.id = p."companyId";

ALTER TABLE "Purchase"
ALTER COLUMN "purchaseDate" SET NOT NULL;

ALTER TABLE "Purchase"
ALTER COLUMN "purchaseDate" SET DEFAULT CURRENT_TIMESTAMP;

COMMIT;
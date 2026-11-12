BEGIN;

-- Never silently round a real sub-cent amount already stored by an old endpoint.
-- Tiny IEEE-754 representation noise is tolerated; business values are preserved.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Payment" WHERE amount <= 0 OR amount::text IN ('NaN','Infinity','-Infinity') OR abs(amount::numeric) > 9999999999.99 OR abs(amount::numeric - round(amount::numeric,2)) > 0.00000001)
    OR EXISTS (SELECT 1 FROM "Product" WHERE "salePrice" < 0 OR "salePrice"::text IN ('NaN','Infinity','-Infinity') OR abs("salePrice"::numeric) > 9999999999.99 OR abs("salePrice"::numeric - round("salePrice"::numeric,2)) > 0.00000001)
    OR EXISTS (SELECT 1 FROM "PurchaseItem" WHERE "unitCost" < 0 OR "unitCost"::text IN ('NaN','Infinity','-Infinity') OR abs("unitCost"::numeric) > 9999999999.99 OR abs("unitCost"::numeric - round("unitCost"::numeric,2)) > 0.00000001)
  THEN RAISE EXCEPTION 'Existing invalid or sub-cent money found. Review Payment.amount, Product.salePrice and PurchaseItem.unitCost; do not reset or delete business data.';
  END IF;
END $$;

ALTER TABLE "Payment" ALTER COLUMN amount TYPE DECIMAL(12,2) USING round(amount::numeric,2);
ALTER TABLE "Product" ALTER COLUMN "salePrice" TYPE DECIMAL(12,2) USING round("salePrice"::numeric,2);
ALTER TABLE "PurchaseItem" ALTER COLUMN "unitCost" TYPE DECIMAL(12,2) USING round("unitCost"::numeric,2);
ALTER TABLE "Stock" ADD COLUMN version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "OperationRequest" (
  id TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  hash TEXT NOT NULL,
  response JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationRequest_pkey" PRIMARY KEY (id),
  CONSTRAINT "OperationRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OperationRequest_companyId_scope_key_key" ON "OperationRequest"("companyId",scope,key);

-- Historical anomalies are retained for review; new writes must satisfy these checks.
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_quantity_nonnegative" CHECK (quantity >= 0) NOT VALID;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_bounds" CHECK (quantity > 0 AND "returnedQty" >= 0 AND "returnedQty" <= quantity AND "unitPrice" >= 0) NOT VALID;
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_quantity_bounds" CHECK (quantity > 0 AND "unitPrice" >= 0) NOT VALID;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_quantity_bounds" CHECK (quantity > 0 AND "unitCost" >= 0) NOT VALID;
ALTER TABLE "PaymentSoldItem" ADD CONSTRAINT "PaymentSoldItem_quantity_bounds" CHECK (quantity > 0) NOT VALID;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK (amount > 0) NOT VALID;
COMMIT;

ALTER TABLE "Company" ADD COLUMN "customMonthlyPriceMinor" INTEGER;

ALTER TABLE "Company" ADD CONSTRAINT "Company_custom_monthly_price_check"
CHECK (
  "customMonthlyPriceMinor" IS NULL OR
  ("customMonthlyPriceMinor" > 0 AND "market" = 'AZ' AND "billingCycle" = 'MONTHLY')
);

-- Extend current standard trials from their original start date.
UPDATE "Company"
SET "trialEndsAt" = "trialStartedAt" + INTERVAL '14 days',
    "endsAt" = "trialStartedAt" + INTERVAL '14 days'
WHERE "trialConvertedAt" IS NULL
  AND "isActive" AND NOT "operatorSuspended" AND NOT "isDemo"
  AND "trialStartedAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
  AND "trialEndsAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
  AND "trialEndsAt" = "trialStartedAt" + INTERVAL '7 days'
  AND "endsAt" = "trialEndsAt";

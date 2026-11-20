BEGIN;
ALTER TABLE "Company" ADD COLUMN "trialEmail" TEXT,
 ADD COLUMN "trialStartedAt" TIMESTAMP(3), ADD COLUMN "trialEndsAt" TIMESTAMP(3),
 ADD COLUMN "trialConvertedAt" TIMESTAMP(3), ADD COLUMN "trialTermsVersion" TEXT;
CREATE UNIQUE INDEX "Company_trialEmail_key" ON "Company"("trialEmail");
ALTER TABLE "Company" ADD CONSTRAINT "Company_trial_dates_check" CHECK (
 ("trialStartedAt" IS NULL AND "trialEndsAt" IS NULL AND "trialConvertedAt" IS NULL)
 OR ("trialStartedAt" IS NOT NULL AND "trialEndsAt" IS NOT NULL AND "trialEndsAt" > "trialStartedAt")
);
CREATE TABLE "TrialInvitation" (
 "id" TEXT NOT NULL PRIMARY KEY, "email" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
 "locale" TEXT NOT NULL DEFAULT 'en', "ipHash" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "usedAt" TIMESTAMP(3), "companyId" TEXT, "requestHash" TEXT,
 CONSTRAINT "TrialInvitation_companyId_fkey" FOREIGN KEY("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TrialInvitation_tokenHash_key" ON "TrialInvitation"("tokenHash");
CREATE INDEX "TrialInvitation_email_createdAt_idx" ON "TrialInvitation"("email","createdAt");
CREATE INDEX "TrialInvitation_ipHash_createdAt_idx" ON "TrialInvitation"("ipHash","createdAt");
CREATE INDEX "TrialInvitation_expiresAt_idx" ON "TrialInvitation"("expiresAt");
COMMIT;

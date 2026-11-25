BEGIN;

ALTER TABLE "Company" ADD COLUMN "trialPhone" TEXT;
CREATE UNIQUE INDEX "Company_trialPhone_key" ON "Company"("trialPhone");

ALTER TABLE "TrialInvitation"
  ALTER COLUMN "email" DROP NOT NULL,
  ADD COLUMN "phone" TEXT,
  ADD CONSTRAINT "TrialInvitation_one_contact_check"
    CHECK (("email" IS NULL) <> ("phone" IS NULL));

CREATE INDEX "TrialInvitation_phone_createdAt_idx" ON "TrialInvitation"("phone", "createdAt");

COMMIT;

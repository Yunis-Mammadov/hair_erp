CREATE TABLE "TrialPhoneChallenge" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "providerOtpId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifyUntil" TIMESTAMP(3),
    "verifiedCodeHash" TEXT,

    CONSTRAINT "TrialPhoneChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrialPhoneChallenge_providerOtpId_key" ON "TrialPhoneChallenge"("providerOtpId");
CREATE INDEX "TrialPhoneChallenge_phone_createdAt_idx" ON "TrialPhoneChallenge"("phone", "createdAt");
CREATE INDEX "TrialPhoneChallenge_ipHash_createdAt_idx" ON "TrialPhoneChallenge"("ipHash", "createdAt");
CREATE INDEX "TrialPhoneChallenge_createdAt_idx" ON "TrialPhoneChallenge"("createdAt");

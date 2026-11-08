-- CreateTable
CREATE TABLE "DriverLiveSession" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverLiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriverLiveSession_driverId_isActive_idx" ON "DriverLiveSession"("driverId", "isActive");

-- AddForeignKey
ALTER TABLE "DriverLiveSession" ADD CONSTRAINT "DriverLiveSession_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

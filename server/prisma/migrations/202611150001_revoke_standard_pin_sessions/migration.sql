-- Revoke sessions/challenges issued before the shared PIN policy was removed.
UPDATE "Company" SET "authVersion" = "authVersion" + 1;

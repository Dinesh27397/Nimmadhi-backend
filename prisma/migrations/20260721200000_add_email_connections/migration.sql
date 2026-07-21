CREATE TYPE "EmailProvider" AS ENUM ('GMAIL', 'OUTLOOK');
CREATE TYPE "EmailConnectionStatus" AS ENUM ('PENDING', 'CONNECTED', 'ERROR');

ALTER TABLE "SmsImportCandidate"
  ADD COLUMN "source" "TransactionSource" NOT NULL DEFAULT 'SMS';

CREATE TABLE "EmailConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "EmailProvider" NOT NULL,
  "status" "EmailConnectionStatus" NOT NULL DEFAULT 'PENDING',
  "emailAddress" TEXT,
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "grantedScopes" TEXT,
  "stateNonce" TEXT,
  "stateExpiresAt" TIMESTAMP(3),
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailConnection_userId_provider_key"
  ON "EmailConnection"("userId", "provider");
CREATE INDEX "EmailConnection_userId_status_idx"
  ON "EmailConnection"("userId", "status");

ALTER TABLE "EmailConnection"
  ADD CONSTRAINT "EmailConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "SmsImportReviewStatus" AS ENUM (
  'PENDING',
  'AUTO_IMPORTED',
  'APPROVED',
  'IGNORED'
);

CREATE TABLE "SmsImportCandidate" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "transactionId" TEXT,
  "deviceMessageId" TEXT NOT NULL,
  "sender" TEXT NOT NULL,
  "messagePreview" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "type" "TransactionType" NOT NULL,
  "category" "TransactionCategory" NOT NULL,
  "status" "TransactionStatus" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "merchantName" TEXT,
  "accountLabel" TEXT,
  "referenceNumber" TEXT,
  "confidence" DECIMAL(3,2) NOT NULL,
  "reviewStatus" "SmsImportReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SmsImportCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmsImportCandidate_transactionId_key"
  ON "SmsImportCandidate"("transactionId");
CREATE UNIQUE INDEX "SmsImportCandidate_userId_deviceMessageId_key"
  ON "SmsImportCandidate"("userId", "deviceMessageId");
CREATE UNIQUE INDEX "SmsImportCandidate_userId_contentHash_key"
  ON "SmsImportCandidate"("userId", "contentHash");
CREATE INDEX "SmsImportCandidate_userId_reviewStatus_occurredAt_idx"
  ON "SmsImportCandidate"("userId", "reviewStatus", "occurredAt");

ALTER TABLE "SmsImportCandidate"
  ADD CONSTRAINT "SmsImportCandidate_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SmsImportCandidate"
  ADD CONSTRAINT "SmsImportCandidate_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

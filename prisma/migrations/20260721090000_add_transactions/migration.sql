-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EMI', 'PAYMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('LOAN', 'SHOPPING', 'FUEL', 'FOOD', 'UTILITIES', 'HEALTHCARE', 'TRANSPORT', 'ENTERTAINMENT', 'CASHBACK', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'SMS', 'EMAIL', 'SYSTEM');

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loanId" TEXT,
    "originalTransactionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "TransactionType" NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'SUCCESS',
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "merchantName" TEXT,
    "accountLabel" TEXT,
    "referenceNumber" TEXT,
    "externalReference" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transaction_userId_occurredAt_idx" ON "Transaction"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "Transaction_userId_type_occurredAt_idx" ON "Transaction"("userId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "Transaction_userId_status_occurredAt_idx" ON "Transaction"("userId", "status", "occurredAt");

-- CreateIndex
CREATE INDEX "Transaction_loanId_idx" ON "Transaction"("loanId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_userId_externalReference_key" ON "Transaction"("userId", "externalReference");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_originalTransactionId_fkey" FOREIGN KEY ("originalTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

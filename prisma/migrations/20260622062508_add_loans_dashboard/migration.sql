-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('HOME_LOAN', 'PERSONAL_LOAN', 'VEHICLE_LOAN', 'GOLD_LOAN', 'CREDIT_CARD', 'EDUCATION_LOAN', 'KADAN', 'OTHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "monthlyIncome" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loanName" TEXT NOT NULL,
    "loanType" "LoanType" NOT NULL,
    "lenderName" TEXT,
    "outstandingAmount" DECIMAL(65,30) NOT NULL,
    "monthlyEmi" DECIMAL(65,30) NOT NULL,
    "interestRate" DECIMAL(65,30) NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "tenureRemainingMonths" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

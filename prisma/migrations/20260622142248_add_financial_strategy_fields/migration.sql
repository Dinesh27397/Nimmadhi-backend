/*
  Warnings:

  - You are about to alter the column `outstandingAmount` on the `Loan` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,2)`.
  - You are about to alter the column `monthlyEmi` on the `Loan` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,2)`.
  - You are about to alter the column `interestRate` on the `Loan` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(5,2)`.
  - You are about to alter the column `monthlyIncome` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,2)`.

*/
-- AlterTable
ALTER TABLE "Loan" ALTER COLUMN "outstandingAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "monthlyEmi" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "interestRate" SET DATA TYPE DECIMAL(5,2);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emergencyFund" DECIMAL(14,2),
ADD COLUMN     "monthlyEssentialExpenses" DECIMAL(14,2),
ALTER COLUMN "monthlyIncome" SET DATA TYPE DECIMAL(14,2);

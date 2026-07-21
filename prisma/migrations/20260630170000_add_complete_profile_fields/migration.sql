-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('SALARIED', 'SELF_EMPLOYED', 'BUSINESS', 'STUDENT', 'HOMEMAKER', 'RETIRED', 'OTHER');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "employmentType" "EmploymentType",
ADD COLUMN "existingEmiTotal" DECIMAL(14, 2),
ADD COLUMN "hasCreditCardDues" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "creditCardDueAmount" DECIMAL(14, 2);

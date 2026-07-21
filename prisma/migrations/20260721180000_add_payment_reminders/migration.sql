CREATE TABLE "PaymentReminderPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "daysBefore" INTEGER[] NOT NULL DEFAULT ARRAY[7, 3, 1]::INTEGER[],
    "reminderHour" INTEGER NOT NULL DEFAULT 9,
    "reminderMinute" INTEGER NOT NULL DEFAULT 0,
    "overdueEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentReminderPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoanReminderPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoanReminderPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentReminderPreference_userId_key" ON "PaymentReminderPreference"("userId");
CREATE UNIQUE INDEX "LoanReminderPreference_loanId_key" ON "LoanReminderPreference"("loanId");
CREATE INDEX "LoanReminderPreference_userId_idx" ON "LoanReminderPreference"("userId");

ALTER TABLE "PaymentReminderPreference" ADD CONSTRAINT "PaymentReminderPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoanReminderPreference" ADD CONSTRAINT "LoanReminderPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoanReminderPreference" ADD CONSTRAINT "LoanReminderPreference_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

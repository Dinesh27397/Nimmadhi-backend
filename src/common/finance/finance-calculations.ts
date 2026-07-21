import { LoanType, Prisma } from '../../../generated/prisma/client.js';

export type FinanceLoan = {
  id: string;
  loanName: string;
  loanType: LoanType;
  lenderName: string | null;
  outstandingAmount: Prisma.Decimal;
  monthlyEmi: Prisma.Decimal;
  interestRate: Prisma.Decimal;
  dueDay?: number;
  tenureRemainingMonths?: number | null;
};

export function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  return value ? Number(value.toString()) : 0;
}

export function roundMoney(value: number) {
  return Number(Math.max(0, value).toFixed(2));
}

export function calculateSuggestedExtraPayment(
  freeCashAfterEssentials: number,
) {
  if (freeCashAfterEssentials <= 0) {
    return 0;
  }

  return roundMoney(Math.min(freeCashAfterEssentials * 0.2, 5000));
}

export function calculateEmiRatio(
  totalMonthlyEmi: number,
  monthlyIncome: number,
) {
  if (monthlyIncome <= 0) {
    return 0;
  }

  return Number(((totalMonthlyEmi / monthlyIncome) * 100).toFixed(2));
}

export function hasHighInterestCreditCard(loans: FinanceLoan[]) {
  return loans.some(
    (loan) =>
      loan.loanType === LoanType.CREDIT_CARD &&
      decimalToNumber(loan.interestRate) > 25,
  );
}

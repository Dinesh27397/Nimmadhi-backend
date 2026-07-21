import { LoanType, Prisma } from '../../generated/prisma/client.js';
import { RepaymentMethod } from './enums/repayment-method.enum.js';
import { StrategyService } from './strategy.service.js';

describe('StrategyService', () => {
  const service = new StrategyService({} as never);

  const loan = (
    id: string,
    loanName: string,
    loanType: LoanType,
    outstandingAmount: number,
    interestRate: number,
  ) => ({
    id,
    loanName,
    loanType,
    lenderName: null,
    outstandingAmount: new Prisma.Decimal(outstandingAmount),
    monthlyEmi: new Prisma.Decimal(1000),
    interestRate: new Prisma.Decimal(interestRate),
  });

  it('sorts avalanche by highest interest then smaller balance', () => {
    const sorted = service.sortLoansForMethod(
      [
        loan('1', 'Large Personal Loan', LoanType.PERSONAL_LOAN, 200000, 14),
        loan('2', 'Small Card', LoanType.CREDIT_CARD, 20000, 36),
        loan('3', 'Large Card', LoanType.CREDIT_CARD, 50000, 36),
      ],
      RepaymentMethod.AVALANCHE,
    );

    expect(sorted.map((item) => item.id)).toEqual(['2', '3', '1']);
  });

  it('prioritizes high-interest credit cards in snowball', () => {
    const sorted = service.sortLoansForMethod(
      [
        loan('1', 'Tiny Kadan', LoanType.KADAN, 5000, 0),
        loan('2', 'Credit Card', LoanType.CREDIT_CARD, 40000, 36),
        loan('3', 'Small Personal Loan', LoanType.PERSONAL_LOAN, 10000, 12),
      ],
      RepaymentMethod.SNOWBALL,
    );

    expect(sorted.map((item) => item.id)).toEqual(['2', '1', '3']);
  });
});

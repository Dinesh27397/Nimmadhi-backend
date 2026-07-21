import { jest } from '@jest/globals';
import { LoanType, Prisma } from '../../generated/prisma/client.js';
import { DashboardService } from './dashboard.service.js';

describe('DashboardService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn<() => Promise<unknown>>(),
    },
  };
  const service = new DashboardService(prisma as never);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-01T09:00:00.000Z'));
    prisma.user.findUnique.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds home dashboard data for the mobile dashboard screen', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      mobile: '8526815030',
      fullName: 'Dinesh',
      monthlyIncome: new Prisma.Decimal(60000),
      monthlyEssentialExpenses: new Prisma.Decimal(25000),
      loans: [
        {
          id: 'loan-1',
          loanName: 'Home Loan',
          loanType: LoanType.HOME_LOAN,
          lenderName: 'HDFC Bank',
          outstandingAmount: new Prisma.Decimal(450000),
          monthlyEmi: new Prisma.Decimal(18750),
          interestRate: new Prisma.Decimal(8.5),
          dueDay: 5,
          tenureRemainingMonths: 54,
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        },
        {
          id: 'loan-2',
          loanName: 'Credit Card',
          loanType: LoanType.CREDIT_CARD,
          lenderName: 'SBI Card',
          outstandingAmount: new Prisma.Decimal(50000),
          monthlyEmi: new Prisma.Decimal(5000),
          interestRate: new Prisma.Decimal(36),
          dueDay: 15,
          tenureRemainingMonths: 10,
          createdAt: new Date('2026-06-02T00:00:00.000Z'),
        },
      ],
    });

    const result = await service.home('user-1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );

    expect(result).toMatchObject({
      success: true,
      dashboard: {
        user: {
          fullName: 'Dinesh',
        },
        overview: {
          totalDebt: 1062500,
          activeLoanCount: 2,
          remainingAmount: 500000,
          debtFreeIn: {
            years: 1,
            months: 8,
            status: 'Ahead',
          },
        },
        upcomingPayment: {
          loanName: 'Home Loan',
          lenderName: 'HDFC Bank',
          amount: 18750,
          dueDay: 5,
          dueInDays: 4,
        },
        tip: {
          title: 'Nimmadhi Tip',
          message: 'Extra payments today, freedom tomorrow.',
        },
        loans: [
          {
            id: 'loan-1',
            loanName: 'Home Loan',
            lenderName: 'HDFC Bank',
            loanType: LoanType.HOME_LOAN,
            outstandingAmount: 450000,
          },
          {
            id: 'loan-2',
            loanName: 'Credit Card',
            lenderName: 'SBI Card',
            loanType: LoanType.CREDIT_CARD,
            outstandingAmount: 50000,
          },
        ],
      },
    });
    expect(result.dashboard.overview.progressPercent).toBeGreaterThanOrEqual(0);
    expect(result.dashboard.overview.progressPercent).toBeLessThanOrEqual(100);
    expect(result.dashboard.loans[0].progressPercent).toBeGreaterThanOrEqual(0);
    expect(result.dashboard.loans[0].progressPercent).toBeLessThanOrEqual(100);
  });
});

import { jest } from '@jest/globals';
import { LoanType, Prisma } from '../../generated/prisma/client.js';
import { PaymentCalendarService } from './payment-calendar.service.js';

describe('PaymentCalendarService', () => {
  const prisma = {
    loan: {
      findMany: jest.fn<() => Promise<unknown>>(),
    },
    transaction: {
      findMany: jest.fn<() => Promise<unknown>>(),
    },
  };
  const service = new PaymentCalendarService(prisma as never);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-21T09:00:00.000Z'));
    prisma.loan.findMany.mockReset();
    prisma.transaction.findMany.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('combines loan schedules and EMI transactions for the selected month', async () => {
    prisma.loan.findMany.mockResolvedValue([
      loan({ id: 'loan-1', dueDay: 5, monthlyEmi: new Prisma.Decimal(10000) }),
      loan({ id: 'loan-2', dueDay: 31, monthlyEmi: new Prisma.Decimal(9000) }),
    ]);
    prisma.transaction.findMany.mockResolvedValue([
      { id: 'txn-1', loanId: 'loan-1', amount: new Prisma.Decimal(10000) },
      { id: 'txn-2', loanId: 'loan-2', amount: new Prisma.Decimal(4000) },
    ]);

    const result = await service.findMonth('user-1', '2026-07');

    expect(result).toMatchObject({
      month: '2026-07',
      monthLabel: 'July 2026',
      summary: {
        totalDue: 19000,
        totalPaid: 14000,
        remaining: 5000,
        paymentCount: 2,
        paidCount: 1,
        overdueCount: 0,
      },
      payments: [
        {
          loanId: 'loan-1',
          dueDate: '2026-07-05',
          paidAmount: 10000,
          status: 'PAID',
        },
        {
          loanId: 'loan-2',
          dueDate: '2026-07-31',
          paidAmount: 4000,
          remainingAmount: 5000,
          status: 'PARTIALLY_PAID',
        },
      ],
    });
    expect(prisma.loan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', isActive: true } }),
    );
  });

  it('clamps due day 31 to the final day of a shorter month', async () => {
    prisma.loan.findMany.mockResolvedValue([loan({ dueDay: 31 })]);
    prisma.transaction.findMany.mockResolvedValue([]);

    const result = await service.findMonth('user-1', '2026-02');

    expect(result.calendar.daysInMonth).toBe(28);
    expect(result.payments[0]).toMatchObject({
      dueDay: 28,
      dueDate: '2026-02-28',
      status: 'OVERDUE',
    });
  });
});

function loan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'loan-1',
    userId: 'user-1',
    loanName: 'Personal loan',
    loanType: LoanType.PERSONAL_LOAN,
    lenderName: 'HDFC Bank',
    outstandingAmount: new Prisma.Decimal(50000),
    monthlyEmi: new Prisma.Decimal(10000),
    interestRate: new Prisma.Decimal(12),
    dueDay: 5,
    tenureRemainingMonths: 5,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

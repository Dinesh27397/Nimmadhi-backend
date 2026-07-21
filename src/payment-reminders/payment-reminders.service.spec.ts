import { jest } from '@jest/globals';
import { LoanType, Prisma } from '../../generated/prisma/client.js';
import { PaymentRemindersService } from './payment-reminders.service.js';

describe('PaymentRemindersService', () => {
  const preference = {
    id: 'preference-1',
    userId: 'user-1',
    enabled: true,
    daysBefore: [7, 3, 1],
    reminderHour: 9,
    reminderMinute: 0,
    overdueEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = {
    paymentReminderPreference: {
      upsert: jest.fn<() => Promise<unknown>>(),
    },
    loanReminderPreference: {
      upsert: jest.fn<() => Promise<unknown>>(),
    },
    loan: {
      findMany: jest.fn<() => Promise<unknown>>(),
      findFirst: jest.fn<() => Promise<unknown>>(),
    },
    transaction: {
      findMany: jest.fn<() => Promise<unknown>>(),
      aggregate: jest.fn<() => Promise<unknown>>(),
      create: jest.fn<() => Promise<unknown>>(),
    },
  };
  const service = new PaymentRemindersService(prisma as never);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-21T04:00:00.000Z'));
    for (const model of Object.values(prisma)) {
      for (const method of Object.values(model)) method.mockReset();
    }
    prisma.paymentReminderPreference.upsert.mockResolvedValue(preference);
  });

  afterEach(() => jest.useRealTimers());

  it('builds upcoming and overdue reminders using user-owned loans', async () => {
    prisma.loan.findMany.mockResolvedValue([
      loan({ id: 'overdue', dueDay: 15 }),
      loan({ id: 'upcoming', dueDay: 25, loanName: 'Car loan' }),
    ]);
    prisma.transaction.findMany.mockResolvedValue([]);

    const result = await service.getReminders('user-1', {
      from: '2026-07-01',
      to: '2026-07-31',
    });

    expect(result.summary).toMatchObject({
      total: 2,
      overdue: 1,
      upcoming: 1,
      paid: 0,
    });
    expect(result.payments[0]).toMatchObject({
      loanId: 'overdue',
      status: 'OVERDUE',
    });
    expect(result.payments[1]).toMatchObject({
      loanId: 'upcoming',
      status: 'UPCOMING',
    });
    expect(result.payments[1].notificationDates).toHaveLength(2);
    expect(prisma.loan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', isActive: true } }),
    );
  });

  it('records only the unpaid EMI balance when marked paid', async () => {
    prisma.loan.findFirst.mockResolvedValue(loan());
    prisma.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(2500) },
    });
    prisma.transaction.create.mockResolvedValue({ id: 'transaction-1' });

    const result = await service.markPaid('user-1', 'loan-1', {
      month: '2026-07',
    });

    expect(result).toMatchObject({
      created: true,
      transactionId: 'transaction-1',
      amount: 7500,
    });
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      // Jest's asymmetric matcher is intentionally untyped at runtime.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        userId: 'user-1',
        loanId: 'loan-1',
        amount: new Prisma.Decimal(7500),
      }),
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
    dueDay: 25,
    tenureRemainingMonths: 5,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    reminderPreference: null,
    ...overrides,
  };
}

import { BadRequestException } from '@nestjs/common';
import { jest } from '@jest/globals';
import {
  Prisma,
  TransactionCategory,
  TransactionSource,
  TransactionStatus,
  TransactionType,
} from '../../generated/prisma/client.js';
import type { Transaction } from '../../generated/prisma/client.js';
import { TransactionsService } from './transactions.service.js';

describe('TransactionsService', () => {
  const prisma = {
    loan: {
      findFirst: jest.fn<() => Promise<unknown>>(),
    },
    transaction: {
      aggregate: jest.fn<() => Promise<unknown>>(),
      create: jest.fn<() => Promise<unknown>>(),
      findFirst: jest.fn<() => Promise<unknown>>(),
      findMany: jest.fn<() => Promise<unknown>>(),
      update: jest.fn<() => Promise<unknown>>(),
    },
  };
  const service = new TransactionsService(prisma as never);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-21T09:00:00.000Z'));
    prisma.loan.findFirst.mockReset();
    prisma.transaction.aggregate.mockReset();
    prisma.transaction.create.mockReset();
    prisma.transaction.findFirst.mockReset();
    prisma.transaction.findMany.mockReset();
    prisma.transaction.update.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates an EMI transaction linked to an owned loan', async () => {
    prisma.loan.findFirst.mockResolvedValue({ id: 'loan-1' });
    prisma.transaction.create.mockResolvedValue(
      transaction({
        title: 'Home Loan EMI',
        type: TransactionType.EMI,
        category: TransactionCategory.LOAN,
        amount: new Prisma.Decimal(18750),
        loanId: 'loan-1',
      }),
    );

    const result = await service.create('user-1', {
      title: 'Home Loan EMI',
      type: TransactionType.EMI,
      category: TransactionCategory.LOAN,
      amount: 18750,
      loanId: 'loan-1',
      occurredAt: '2026-07-20T08:30:00.000Z',
    });

    expect(prisma.loan.findFirst).toHaveBeenCalledWith({
      where: { id: 'loan-1', userId: 'user-1', isActive: true },
      select: { id: true },
    });
    expect(result).toMatchObject({
      title: 'Home Loan EMI',
      amount: 18750,
      direction: 'DEBIT',
      statusLabel: 'Paid',
      loanId: 'loan-1',
    });
  });

  it('requires a loan for EMI transactions', async () => {
    await expect(
      service.create('user-1', {
        title: 'EMI',
        type: TransactionType.EMI,
        category: TransactionCategory.LOAN,
        amount: 5000,
        occurredAt: '2026-07-20T08:30:00.000Z',
      }),
    ).rejects.toThrow(
      new BadRequestException('loanId is required for EMI transactions'),
    );
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('builds screen totals, comparison, trend, and recent transactions', async () => {
    prisma.transaction.findMany
      .mockResolvedValueOnce([
        transaction({
          id: 'emi-1',
          title: 'Home Loan EMI',
          type: TransactionType.EMI,
          category: TransactionCategory.LOAN,
          amount: new Prisma.Decimal(18750),
          occurredAt: new Date('2026-07-20T08:30:00.000Z'),
        }),
        transaction({
          id: 'payment-1',
          title: 'Amazon India',
          amount: new Prisma.Decimal(2450),
          occurredAt: new Date('2026-07-17T08:30:00.000Z'),
        }),
        transaction({
          id: 'refund-1',
          title: 'Cashback Received',
          type: TransactionType.REFUND,
          category: TransactionCategory.CASHBACK,
          amount: new Prisma.Decimal(750),
          occurredAt: new Date('2026-07-15T08:30:00.000Z'),
        }),
      ])
      .mockResolvedValueOnce([
        transaction({ amount: new Prisma.Decimal(25000) }),
      ]);

    const result = await service.overview('user-1', {
      from: '2026-07-01',
      to: '2026-07-20',
    });

    expect(result).toMatchObject({
      summary: {
        totalSpent: 21200,
        refunds: 750,
        netSpent: 20450,
        previousPeriodSpent: 25000,
        changePercent: -15.2,
      },
      breakdown: {
        all: 21200,
        emiPayments: 18750,
        otherPayments: 2450,
        refunds: 750,
      },
    });
    expect(result.trend).toHaveLength(3);
    expect(result.recentTransactions[2]).toMatchObject({
      direction: 'CREDIT',
      statusLabel: 'Received',
    });
  });

  it('blocks refunds greater than the remaining refundable amount', async () => {
    prisma.transaction.findFirst.mockResolvedValue(
      transaction({ id: 'payment-1', amount: new Prisma.Decimal(1000) }),
    );
    prisma.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(800) },
    });

    await expect(
      service.create('user-1', {
        title: 'Refund',
        type: TransactionType.REFUND,
        category: TransactionCategory.OTHER,
        amount: 300,
        originalTransactionId: 'payment-1',
        occurredAt: '2026-07-20T08:30:00.000Z',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Refund amount exceeds the remaining refundable amount',
      ),
    );
  });
});

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'transaction-1',
    userId: 'user-1',
    loanId: null,
    originalTransactionId: null,
    title: 'Amazon India',
    description: null,
    type: TransactionType.PAYMENT,
    category: TransactionCategory.SHOPPING,
    status: TransactionStatus.SUCCESS,
    source: TransactionSource.MANUAL,
    amount: new Prisma.Decimal(1000),
    currency: 'INR',
    merchantName: null,
    accountLabel: null,
    referenceNumber: null,
    externalReference: null,
    occurredAt: new Date('2026-07-20T08:30:00.000Z'),
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date('2026-07-20T08:30:00.000Z'),
    updatedAt: new Date('2026-07-20T08:30:00.000Z'),
    ...overrides,
  };
}

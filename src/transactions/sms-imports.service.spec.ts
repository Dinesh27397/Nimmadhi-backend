import { jest } from '@jest/globals';
import {
  Prisma,
  SmsImportReviewStatus,
  TransactionCategory,
  TransactionSource,
  TransactionStatus,
  TransactionType,
} from '../../generated/prisma/client.js';
import { SmsImportsService } from './sms-imports.service.js';

const now = new Date('2026-07-21T08:30:00.000Z');
const candidate = {
  id: 'candidate-1',
  userId: 'user-1',
  transactionId: null,
  deviceMessageId: 'sms-1',
  sender: 'VK-HDFCBK',
  source: TransactionSource.SMS,
  messagePreview: 'Rs 1,250 debited from A/c XX4567 at Indian Oil.',
  contentHash: 'hash-1',
  occurredAt: now,
  type: TransactionType.PAYMENT,
  category: TransactionCategory.FUEL,
  status: TransactionStatus.SUCCESS,
  amount: new Prisma.Decimal(1250),
  currency: 'INR',
  merchantName: 'Indian Oil',
  accountLabel: '???? 4567',
  referenceNumber: 'UTR123456',
  confidence: new Prisma.Decimal(0.95),
  reviewStatus: SmsImportReviewStatus.PENDING,
  reviewedAt: null,
  createdAt: now,
  updatedAt: now,
};

describe('SmsImportsService', () => {
  const transactionClient = {
    transaction: { create: jest.fn() },
    smsImportCandidate: { update: jest.fn() },
  };
  const prisma = {
    transaction: {
      findMany: jest.fn(),
    },
    smsImportCandidate: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new SmsImportsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.smsImportCandidate.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation((callback) =>
      Promise.resolve(callback(transactionClient)),
    );
  });

  it('auto-imports a high-confidence financial SMS', async () => {
    prisma.smsImportCandidate.create.mockResolvedValue(candidate);
    transactionClient.transaction.create.mockResolvedValue({
      id: 'transaction-1',
    });
    transactionClient.smsImportCandidate.update.mockResolvedValue({
      ...candidate,
      transactionId: 'transaction-1',
      reviewStatus: SmsImportReviewStatus.AUTO_IMPORTED,
      reviewedAt: now,
    });

    const result = await service.importMessages('user-1', {
      messages: [
        {
          id: 'sms-1',
          sender: 'VK-HDFCBK',
          body: 'Rs.1,250 debited from A/c XX4567 at Indian Oil. Ref UTR123456.',
          occurredAt: now.toISOString(),
        },
      ],
    });

    expect(result).toMatchObject({
      received: 1,
      detected: 1,
      autoImported: 1,
      pendingReview: 0,
      duplicates: 0,
    });
    expect(transactionClient.transaction.create).toHaveBeenCalledWith({
      // Jest asymmetric matchers are intentionally dynamic test values.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        userId: 'user-1',
        source: TransactionSource.SMS,
        amount: new Prisma.Decimal(1250),
      }),
    });
  });

  it('does not create another candidate for a duplicate SMS', async () => {
    prisma.smsImportCandidate.findMany.mockResolvedValue([
      {
        deviceMessageId: 'sms-1',
        contentHash: 'existing-hash',
      },
    ]);

    const result = await service.importMessages('user-1', {
      messages: [
        {
          id: 'sms-1',
          sender: 'VK-HDFCBK',
          body: 'Rs.1,250 debited from A/c XX4567. Ref UTR123456.',
          occurredAt: now.toISOString(),
        },
      ],
    });

    expect(result.duplicates).toBe(1);
    expect(prisma.smsImportCandidate.create).not.toHaveBeenCalled();
    expect(transactionClient.transaction.create).not.toHaveBeenCalled();
  });

  it('checks a large duplicate batch with one candidate query', async () => {
    const messages = Array.from({ length: 100 }, (_, index) => ({
      id: `sms-${index}`,
      sender: 'VK-HDFCBK',
      body: `Rs 500 debited from A/c XX4567 at Merchant ${index}.`,
      occurredAt: new Date(now.getTime() + index).toISOString(),
    }));
    prisma.smsImportCandidate.findMany.mockImplementation(({ where }) =>
      Promise.resolve(
        where.OR[0].deviceMessageId.in.map((deviceMessageId: string) => ({
          deviceMessageId,
          contentHash: `existing-${deviceMessageId}`,
        })),
      ),
    );

    const result = await service.importMessages('user-1', { messages });

    expect(result).toMatchObject({
      received: 100,
      detected: 100,
      duplicates: 100,
      autoImported: 0,
    });
    expect(prisma.smsImportCandidate.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.transaction.findMany).not.toHaveBeenCalled();
    expect(prisma.smsImportCandidate.create).not.toHaveBeenCalled();
  });

  it('skips an uncertain message instead of asking the user to approve it', async () => {
    const result = await service.importMessages('user-1', {
      messages: [
        {
          id: 'sms-uncertain',
          sender: 'UNKNOWN',
          body: 'Rs 500 debited.',
          occurredAt: now.toISOString(),
        },
      ],
    });

    expect(result).toMatchObject({
      received: 1,
      detected: 0,
      autoImported: 0,
      pendingReview: 0,
      skipped: 1,
    });
    expect(prisma.smsImportCandidate.create).not.toHaveBeenCalled();
    expect(transactionClient.transaction.create).not.toHaveBeenCalled();
  });

  it('marks a pending candidate as ignored', async () => {
    prisma.smsImportCandidate.findFirst.mockResolvedValue(candidate);
    prisma.smsImportCandidate.update.mockResolvedValue({
      ...candidate,
      reviewStatus: SmsImportReviewStatus.IGNORED,
      reviewedAt: now,
    });

    const result = await service.review('user-1', 'candidate-1', {
      action: 'IGNORE',
    });

    expect(result.reviewStatus).toBe(SmsImportReviewStatus.IGNORED);
    expect(prisma.smsImportCandidate.update).toHaveBeenCalledWith({
      where: { id: 'candidate-1' },
      // Jest asymmetric matchers are intentionally dynamic test values.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        reviewStatus: SmsImportReviewStatus.IGNORED,
      }),
    });
  });
});

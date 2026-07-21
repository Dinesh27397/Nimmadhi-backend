import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TransactionStatus,
  TransactionType,
} from '../../generated/prisma/client.js';
import type { Transaction } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { TransactionOverviewQueryDto } from './dto/transaction-overview-query.dto.js';
import { TransactionQueryDto } from './dto/transaction-query.dto.js';
import { UpdateTransactionDto } from './dto/update-transaction.dto.js';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTransactionDto) {
    await this.validateRelations(userId, dto);

    try {
      const transaction = await this.prisma.transaction.create({
        data: {
          userId,
          loanId: dto.loanId,
          originalTransactionId: dto.originalTransactionId,
          title: dto.title.trim(),
          description: dto.description?.trim(),
          type: dto.type,
          category: dto.category,
          status: dto.status,
          source: dto.source,
          amount: new Prisma.Decimal(dto.amount),
          currency: dto.currency?.toUpperCase(),
          merchantName: dto.merchantName?.trim(),
          accountLabel: dto.accountLabel?.trim(),
          referenceNumber: dto.referenceNumber?.trim(),
          externalReference: dto.externalReference?.trim(),
          occurredAt: new Date(dto.occurredAt),
        },
      });

      return this.toResponse(transaction);
    } catch (error) {
      this.rethrowKnownDatabaseError(error);
    }
  }

  async findAll(userId: string, query: TransactionQueryDto) {
    const where = this.buildWhere(userId, query);
    const limit = query.limit ?? 20;

    if (query.cursor) {
      const cursor = await this.prisma.transaction.findFirst({
        where: { id: query.cursor, userId, isDeleted: false },
        select: { id: true },
      });
      if (!cursor) {
        throw new BadRequestException('Invalid transaction cursor');
      }
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : undefined),
    });
    const hasMore = transactions.length > limit;
    const items = hasMore ? transactions.slice(0, limit) : transactions;

    return {
      items: items.map((transaction) => this.toResponse(transaction)),
      nextCursor: hasMore ? items.at(-1)?.id : null,
      hasMore,
    };
  }

  async overview(userId: string, query: TransactionOverviewQueryDto) {
    const { from, to } = this.resolveOverviewPeriod(query);
    const duration = to.getTime() - from.getTime() + 1;
    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - duration + 1);

    const [current, previous] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId,
          isDeleted: false,
          status: TransactionStatus.SUCCESS,
          occurredAt: { gte: from, lte: to },
        },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.transaction.findMany({
        where: {
          userId,
          isDeleted: false,
          status: TransactionStatus.SUCCESS,
          occurredAt: { gte: previousFrom, lte: previousTo },
        },
      }),
    ]);

    const currentTotals = this.calculateTotals(current);
    const previousTotals = this.calculateTotals(previous);

    return {
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      summary: {
        totalSpent: currentTotals.totalSpent,
        refunds: currentTotals.refunds,
        netSpent: currentTotals.netSpent,
        previousPeriodSpent: previousTotals.totalSpent,
        changePercent: this.calculateChangePercent(
          currentTotals.totalSpent,
          previousTotals.totalSpent,
        ),
        currency: 'INR',
      },
      breakdown: {
        all: currentTotals.totalSpent,
        emiPayments: currentTotals.emiPayments,
        otherPayments: currentTotals.otherPayments,
        refunds: currentTotals.refunds,
      },
      trend: this.buildTrend(current),
      recentTransactions: current
        .slice(0, 5)
        .map((transaction) => this.toResponse(transaction)),
    };
  }

  async findOne(userId: string, id: string) {
    const transaction = await this.getOwnedTransaction(userId, id);
    return this.toResponse(transaction);
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    const existing = await this.getOwnedTransaction(userId, id);
    const merged = {
      ...dto,
      type: dto.type ?? existing.type,
      amount: dto.amount ?? Number(existing.amount.toString()),
      loanId: dto.loanId ?? existing.loanId ?? undefined,
      originalTransactionId:
        dto.originalTransactionId ??
        existing.originalTransactionId ??
        undefined,
    };
    await this.validateRelations(userId, merged, id);

    try {
      const transaction = await this.prisma.transaction.update({
        where: { id },
        data: {
          loanId: dto.loanId,
          originalTransactionId: dto.originalTransactionId,
          title: dto.title?.trim(),
          description: dto.description?.trim(),
          type: dto.type,
          category: dto.category,
          status: dto.status,
          source: dto.source,
          amount:
            dto.amount === undefined
              ? undefined
              : new Prisma.Decimal(dto.amount),
          currency: dto.currency?.toUpperCase(),
          merchantName: dto.merchantName?.trim(),
          accountLabel: dto.accountLabel?.trim(),
          referenceNumber: dto.referenceNumber?.trim(),
          externalReference: dto.externalReference?.trim(),
          occurredAt:
            dto.occurredAt === undefined ? undefined : new Date(dto.occurredAt),
        },
      });

      return this.toResponse(transaction);
    } catch (error) {
      this.rethrowKnownDatabaseError(error);
    }
  }

  async remove(userId: string, id: string) {
    await this.getOwnedTransaction(userId, id);
    await this.prisma.transaction.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    return { success: true, message: 'Transaction deleted' };
  }

  private buildWhere(userId: string, query: TransactionQueryDto) {
    const where: Prisma.TransactionWhereInput = {
      userId,
      isDeleted: false,
      type: query.type,
      category: query.category,
      status: query.status,
    };

    if (query.from || query.to) {
      const from = query.from ? this.startBoundary(query.from) : undefined;
      const to = query.to ? this.endBoundary(query.to) : undefined;
      if (from && to) {
        this.validateDateRange(from, to);
      }
      where.occurredAt = { gte: from, lte: to };
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { merchantName: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private resolveOverviewPeriod(query: TransactionOverviewQueryDto) {
    const now = new Date();
    const from = query.from
      ? this.startBoundary(query.from)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = query.to ? this.endBoundary(query.to) : now;
    this.validateDateRange(from, to);
    return { from, to };
  }

  private startBoundary(value: string) {
    const date = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date.setUTCHours(0, 0, 0, 0);
    }
    return date;
  }

  private endBoundary(value: string) {
    const date = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date.setUTCHours(23, 59, 59, 999);
    }
    return date;
  }

  private validateDateRange(from: Date, to: Date) {
    if (from > to) {
      throw new BadRequestException('from must be before or equal to to');
    }
    const maximumRangeMs = 366 * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maximumRangeMs) {
      throw new BadRequestException('Date range cannot exceed 366 days');
    }
  }

  private async validateRelations(
    userId: string,
    dto: Pick<
      CreateTransactionDto,
      'type' | 'amount' | 'loanId' | 'originalTransactionId'
    >,
    currentTransactionId?: string,
  ) {
    if (dto.type === TransactionType.EMI && !dto.loanId) {
      throw new BadRequestException('loanId is required for EMI transactions');
    }

    if (dto.loanId) {
      const loan = await this.prisma.loan.findFirst({
        where: { id: dto.loanId, userId, isActive: true },
        select: { id: true },
      });
      if (!loan) {
        throw new BadRequestException('Loan not found for this user');
      }
    }

    if (dto.type !== TransactionType.REFUND) {
      if (dto.originalTransactionId) {
        throw new BadRequestException(
          'originalTransactionId is only allowed for refunds',
        );
      }
      return;
    }

    if (!dto.originalTransactionId) {
      throw new BadRequestException(
        'originalTransactionId is required for refunds',
      );
    }
    if (dto.originalTransactionId === currentTransactionId) {
      throw new BadRequestException('A refund cannot reference itself');
    }

    const original = await this.prisma.transaction.findFirst({
      where: {
        id: dto.originalTransactionId,
        userId,
        isDeleted: false,
        status: TransactionStatus.SUCCESS,
        type: { not: TransactionType.REFUND },
      },
    });
    if (!original) {
      throw new BadRequestException('Original transaction not found');
    }

    const refunded = await this.prisma.transaction.aggregate({
      where: {
        userId,
        originalTransactionId: original.id,
        type: TransactionType.REFUND,
        status: TransactionStatus.SUCCESS,
        isDeleted: false,
        ...(currentTransactionId ? { id: { not: currentTransactionId } } : {}),
      },
      _sum: { amount: true },
    });
    const previouslyRefunded = Number(refunded._sum.amount?.toString() ?? 0);
    const originalAmount = Number(original.amount.toString());
    if (previouslyRefunded + dto.amount > originalAmount) {
      throw new BadRequestException(
        'Refund amount exceeds the remaining refundable amount',
      );
    }
  }

  private async getOwnedTransaction(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId, isDeleted: false },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

  private calculateTotals(transactions: Transaction[]) {
    const emiPayments = this.sumAmounts(
      transactions.filter((item) => item.type === TransactionType.EMI),
    );
    const otherPayments = this.sumAmounts(
      transactions.filter((item) => item.type === TransactionType.PAYMENT),
    );
    const refunds = this.sumAmounts(
      transactions.filter((item) => item.type === TransactionType.REFUND),
    );
    const totalSpent = this.roundMoney(emiPayments + otherPayments);

    return {
      emiPayments,
      otherPayments,
      refunds,
      totalSpent,
      netSpent: this.roundMoney(totalSpent - refunds),
    };
  }

  private buildTrend(transactions: Transaction[]) {
    const days = new Map<
      string,
      { date: string; spent: number; refunds: number; netSpent: number }
    >();
    for (const transaction of transactions) {
      const date = transaction.occurredAt.toISOString().slice(0, 10);
      const existing = days.get(date) ?? {
        date,
        spent: 0,
        refunds: 0,
        netSpent: 0,
      };
      const amount = Number(transaction.amount.toString());
      if (transaction.type === TransactionType.REFUND) {
        existing.refunds += amount;
      } else {
        existing.spent += amount;
      }
      existing.spent = this.roundMoney(existing.spent);
      existing.refunds = this.roundMoney(existing.refunds);
      existing.netSpent = this.roundMoney(existing.spent - existing.refunds);
      days.set(date, existing);
    }

    return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  private sumAmounts(transactions: Transaction[]) {
    return this.roundMoney(
      transactions.reduce(
        (total, item) => total + Number(item.amount.toString()),
        0,
      ),
    );
  }

  private calculateChangePercent(current: number, previous: number) {
    if (previous === 0) {
      return current === 0 ? 0 : 100;
    }
    return Number((((current - previous) / previous) * 100).toFixed(2));
  }

  private roundMoney(value: number) {
    return Number(value.toFixed(2));
  }

  private toResponse(transaction: Transaction) {
    const isRefund = transaction.type === TransactionType.REFUND;
    return {
      id: transaction.id,
      title: transaction.title,
      subtitle:
        transaction.description ??
        [transaction.merchantName, transaction.accountLabel]
          .filter(Boolean)
          .join(' '),
      description: transaction.description ?? undefined,
      type: transaction.type,
      category: transaction.category,
      status: transaction.status,
      statusLabel: this.statusLabel(transaction),
      source: transaction.source,
      amount: Number(transaction.amount.toString()),
      currency: transaction.currency,
      direction: isRefund ? 'CREDIT' : 'DEBIT',
      merchantName: transaction.merchantName ?? undefined,
      accountLabel: transaction.accountLabel ?? undefined,
      referenceNumber: transaction.referenceNumber ?? undefined,
      externalReference: transaction.externalReference ?? undefined,
      loanId: transaction.loanId ?? undefined,
      originalTransactionId: transaction.originalTransactionId ?? undefined,
      occurredAt: transaction.occurredAt.toISOString(),
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    };
  }

  private statusLabel(transaction: Transaction) {
    if (transaction.status === TransactionStatus.SUCCESS) {
      return transaction.type === TransactionType.REFUND ? 'Received' : 'Paid';
    }
    const labels: Record<TransactionStatus, string> = {
      [TransactionStatus.PENDING]: 'Pending',
      [TransactionStatus.SUCCESS]: 'Paid',
      [TransactionStatus.FAILED]: 'Failed',
      [TransactionStatus.CANCELLED]: 'Cancelled',
    };
    return labels[transaction.status];
  }

  private rethrowKnownDatabaseError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Transaction already exists');
    }
    throw error;
  }
}

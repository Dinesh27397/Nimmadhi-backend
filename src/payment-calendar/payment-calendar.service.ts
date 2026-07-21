import { Injectable } from '@nestjs/common';
import {
  Prisma,
  TransactionStatus,
  TransactionType,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type PaymentCalendarStatus =
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'DUE_TODAY'
  | 'UPCOMING';

@Injectable()
export class PaymentCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async findMonth(userId: string, month?: string) {
    const now = new Date();
    const selectedMonth = month ?? this.monthKey(now);
    const [year, monthNumber] = selectedMonth.split('-').map(Number);
    const monthIndex = monthNumber - 1;
    const monthStart = new Date(Date.UTC(year, monthIndex, 1));
    const nextMonthStart = new Date(Date.UTC(year, monthIndex + 1, 1));
    const daysInMonth = new Date(
      Date.UTC(year, monthIndex + 1, 0),
    ).getUTCDate();

    const [loans, emiTransactions] = await Promise.all([
      this.prisma.loan.findMany({
        where: { userId, isActive: true },
        orderBy: [{ dueDay: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.transaction.findMany({
        where: {
          userId,
          loanId: { not: null },
          type: TransactionType.EMI,
          status: TransactionStatus.SUCCESS,
          isDeleted: false,
          occurredAt: { gte: monthStart, lt: nextMonthStart },
        },
        select: { id: true, loanId: true, amount: true },
      }),
    ]);

    const transactionsByLoan = new Map<
      string,
      Array<{ id: string; amount: Prisma.Decimal }>
    >();
    for (const transaction of emiTransactions) {
      if (!transaction.loanId) {
        continue;
      }
      const existing = transactionsByLoan.get(transaction.loanId) ?? [];
      existing.push({ id: transaction.id, amount: transaction.amount });
      transactionsByLoan.set(transaction.loanId, existing);
    }

    const today = this.dateKeyInIndia(now);
    const payments = loans.map((loan) => {
      const dueDay = Math.min(loan.dueDay, daysInMonth);
      const dueDate = selectedMonth + '-' + String(dueDay).padStart(2, '0');
      const transactions = transactionsByLoan.get(loan.id) ?? [];
      const amount = this.decimalToNumber(loan.monthlyEmi);
      const paidAmount = this.roundMoney(
        transactions.reduce(
          (total, transaction) =>
            total + this.decimalToNumber(transaction.amount),
          0,
        ),
      );

      return {
        id: loan.id + ':' + selectedMonth,
        loanId: loan.id,
        loanName: loan.loanName,
        lenderName: loan.lenderName,
        loanType: loan.loanType,
        amount,
        paidAmount,
        remainingAmount: this.roundMoney(Math.max(0, amount - paidAmount)),
        dueDay,
        dueDate,
        status: this.paymentStatus(amount, paidAmount, dueDate, today),
        transactionIds: transactions.map((transaction) => transaction.id),
      };
    });

    const totalDue = this.roundMoney(
      payments.reduce((total, payment) => total + payment.amount, 0),
    );
    const totalPaid = this.roundMoney(
      payments.reduce(
        (total, payment) =>
          total + Math.min(payment.amount, payment.paidAmount),
        0,
      ),
    );

    return {
      month: selectedMonth,
      monthLabel: monthStart.toLocaleString('en-IN', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
      today,
      calendar: {
        daysInMonth,
        firstDayOfWeek: monthStart.getUTCDay(),
      },
      summary: {
        totalDue,
        totalPaid,
        remaining: this.roundMoney(Math.max(0, totalDue - totalPaid)),
        paymentCount: payments.length,
        paidCount: payments.filter((payment) => payment.status === 'PAID')
          .length,
        overdueCount: payments.filter((payment) => payment.status === 'OVERDUE')
          .length,
      },
      payments,
    };
  }

  private paymentStatus(
    amount: number,
    paidAmount: number,
    dueDate: string,
    today: string,
  ): PaymentCalendarStatus {
    if (paidAmount >= amount) {
      return 'PAID';
    }
    if (paidAmount > 0) {
      return 'PARTIALLY_PAID';
    }
    if (dueDate < today) {
      return 'OVERDUE';
    }
    if (dueDate === today) {
      return 'DUE_TODAY';
    }
    return 'UPCOMING';
  }

  private monthKey(date: Date) {
    return this.dateKeyInIndia(date).slice(0, 7);
  }

  private dateKeyInIndia(date: Date) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';
    return value('year') + '-' + value('month') + '-' + value('day');
  }

  private decimalToNumber(value: Prisma.Decimal) {
    return Number(value.toString());
  }

  private roundMoney(value: number) {
    return Number(value.toFixed(2));
  }
}

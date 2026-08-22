import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TransactionCategory,
  TransactionSource,
  TransactionStatus,
  TransactionType,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MarkPaymentPaidDto } from './dto/mark-payment-paid.dto.js';
import { ReminderQueryDto } from './dto/reminder-query.dto.js';
import { UpdateLoanReminderDto } from './dto/update-loan-reminder.dto.js';
import { UpdateReminderPreferencesDto } from './dto/update-reminder-preferences.dto.js';

const DEFAULT_DAYS_BEFORE = [7, 3, 1];

@Injectable()
export class PaymentRemindersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string) {
    const [preference, loans] = await Promise.all([
      this.ensurePreference(userId),
      this.prisma.loan.findMany({
        where: { userId, isActive: true },
        include: { reminderPreference: true },
        orderBy: [{ dueDay: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    return {
      ...preference,
      daysBefore: [...preference.daysBefore].sort((a, b) => b - a),
      loans: loans.map((loan) => ({
        loanId: loan.id,
        loanName: loan.loanName,
        lenderName: loan.lenderName,
        dueDay: loan.dueDay,
        amount: this.decimalToNumber(loan.monthlyEmi),
        enabled: loan.reminderPreference?.enabled ?? true,
      })),
    };
  }

  async updatePreferences(userId: string, dto: UpdateReminderPreferencesDto) {
    const daysBefore = dto.daysBefore
      ? [...dto.daysBefore].sort((a, b) => b - a)
      : undefined;
    await this.prisma.paymentReminderPreference.upsert({
      where: { userId },
      create: {
        userId,
        enabled: dto.enabled ?? true,
        daysBefore: daysBefore ?? DEFAULT_DAYS_BEFORE,
        reminderHour: dto.reminderHour ?? 9,
        reminderMinute: dto.reminderMinute ?? 0,
        overdueEnabled: dto.overdueEnabled ?? true,
      },
      update: { ...dto, daysBefore },
    });
    return this.getPreferences(userId);
  }

  async updateLoanPreference(
    userId: string,
    loanId: string,
    dto: UpdateLoanReminderDto,
  ) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, userId },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }
    await this.prisma.loanReminderPreference.upsert({
      where: { loanId },
      create: { userId, loanId, enabled: dto.enabled },
      update: { enabled: dto.enabled },
    });
    return this.getPreferences(userId);
  }

  async getReminders(userId: string, query: ReminderQueryDto) {
    const now = new Date();
    const today = this.indiaDateKey(now);
    const from = query.from?.slice(0, 10) ?? this.shiftDateKey(today, -7);
    const to = query.to?.slice(0, 10) ?? this.shiftDateKey(today, 45);
    if (from > to || this.daysBetween(from, to) > 93) {
      throw new BadRequestException('Reminder range must be 93 days or less');
    }

    const preference = await this.ensurePreference(userId);
    const monthKeys = this.monthKeysBetween(from, to);
    const rangeStart = this.monthStart(monthKeys[0]);
    const rangeEnd = this.monthStart(this.nextMonth(monthKeys.at(-1)!));
    const [loans, transactions] = await Promise.all([
      this.prisma.loan.findMany({
        where: { userId, isActive: true },
        include: { reminderPreference: true },
        orderBy: [{ dueDay: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.transaction.findMany({
        where: {
          userId,
          loanId: { not: null },
          type: TransactionType.EMI,
          status: TransactionStatus.SUCCESS,
          isDeleted: false,
          occurredAt: { gte: rangeStart, lt: rangeEnd },
        },
        select: { id: true, loanId: true, amount: true, occurredAt: true },
      }),
    ]);

    const paidByLoanMonth = new Map<
      string,
      { amount: number; ids: string[] }
    >();
    for (const transaction of transactions) {
      if (!transaction.loanId) continue;
      const key =
        transaction.loanId +
        ':' +
        this.indiaDateKey(transaction.occurredAt).slice(0, 7);
      const current = paidByLoanMonth.get(key) ?? { amount: 0, ids: [] };
      current.amount += this.decimalToNumber(transaction.amount);
      current.ids.push(transaction.id);
      paidByLoanMonth.set(key, current);
    }

    const payments = monthKeys.flatMap((month) =>
      loans.flatMap((loan) => {
        const dueDay = Math.min(loan.dueDay, this.daysInMonth(month));
        const dueDate = month + '-' + String(dueDay).padStart(2, '0');
        if (dueDate < from || dueDate > to) return [];
        const amount = this.decimalToNumber(loan.monthlyEmi);
        const paid = paidByLoanMonth.get(loan.id + ':' + month) ?? {
          amount: 0,
          ids: [],
        };
        const paidAmount = this.roundMoney(paid.amount);
        const remainingAmount = this.roundMoney(
          Math.max(0, amount - paidAmount),
        );
        const status =
          paidAmount >= amount
            ? 'PAID'
            : dueDate < today
              ? 'OVERDUE'
              : dueDate === today
                ? 'DUE_TODAY'
                : 'UPCOMING';
        const loanEnabled = loan.reminderPreference?.enabled ?? true;
        const notificationDates =
          preference.enabled && loanEnabled && status !== 'PAID'
            ? this.notificationDates(dueDate, today, preference)
            : [];

        return [
          {
            id: loan.id + ':' + month,
            loanId: loan.id,
            loanName: loan.loanName,
            lenderName: loan.lenderName,
            amount,
            paidAmount,
            remainingAmount,
            dueDate,
            month,
            status,
            isReminderEnabled: preference.enabled && loanEnabled,
            notificationDates,
            transactionIds: paid.ids,
          },
        ];
      }),
    );

    return {
      generatedAt: now.toISOString(),
      from,
      to,
      preferences: {
        enabled: preference.enabled,
        daysBefore: preference.daysBefore,
        reminderHour: preference.reminderHour,
        reminderMinute: preference.reminderMinute,
        overdueEnabled: preference.overdueEnabled,
      },
      summary: {
        total: payments.length,
        upcoming: payments.filter((item) => item.status === 'UPCOMING').length,
        dueToday: payments.filter((item) => item.status === 'DUE_TODAY').length,
        overdue: payments.filter((item) => item.status === 'OVERDUE').length,
        paid: payments.filter((item) => item.status === 'PAID').length,
      },
      payments,
    };
  }

  async markPaid(userId: string, loanId: string, dto: MarkPaymentPaidDto) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, userId },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    const start = this.monthStart(dto.month);
    const end = this.monthStart(this.nextMonth(dto.month));
    const aggregate = await this.prisma.transaction.aggregate({
      where: {
        userId,
        loanId,
        type: TransactionType.EMI,
        status: TransactionStatus.SUCCESS,
        isDeleted: false,
        occurredAt: { gte: start, lt: end },
      },
      _sum: { amount: true },
    });
    const emi = this.decimalToNumber(loan.monthlyEmi);
    const alreadyPaid = aggregate._sum.amount
      ? this.decimalToNumber(aggregate._sum.amount)
      : 0;
    const remaining = this.roundMoney(Math.max(0, emi - alreadyPaid));
    if (remaining === 0)
      return { created: false, message: 'Payment is already marked as paid' };
    const amount = dto.amount ?? remaining;
    if (amount > remaining) {
      throw new BadRequestException(
        'Amount cannot exceed the remaining EMI amount',
      );
    }
    const dueDay = Math.min(loan.dueDay, this.daysInMonth(dto.month));
    const occurredAt = new Date(
      dto.month + '-' + String(dueDay).padStart(2, '0') + 'T06:30:00.000Z',
    );
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        loanId,
        title: loan.loanName + ' EMI',
        description: 'Marked paid from payment reminder',
        type: TransactionType.EMI,
        category: TransactionCategory.LOAN,
        status: TransactionStatus.SUCCESS,
        source: TransactionSource.MANUAL,
        amount: new Prisma.Decimal(amount),
        merchantName: loan.lenderName,
        occurredAt,
      },
    });

    const currentOutstanding = this.decimalToNumber(loan.outstandingAmount);
    const newOutstanding = this.roundMoney(Math.max(0, currentOutstanding - amount));
    const newTenure =
      loan.tenureRemainingMonths && loan.tenureRemainingMonths > 0
        ? loan.tenureRemainingMonths - 1
        : loan.tenureRemainingMonths;
    await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        outstandingAmount: new Prisma.Decimal(newOutstanding),
        tenureRemainingMonths: newTenure,
        isActive: newOutstanding > 0,
      },
    });
    return {
      created: true,
      transactionId: transaction.id,
      amount,
      month: dto.month,
    };
  }

  private ensurePreference(userId: string) {
    return this.prisma.paymentReminderPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  private notificationDates(
    dueDate: string,
    today: string,
    preference: {
      daysBefore: number[];
      reminderHour: number;
      reminderMinute: number;
      overdueEnabled: boolean;
    },
  ) {
    if (dueDate < today) {
      return preference.overdueEnabled
        ? [new Date(Date.now() + 60_000).toISOString()]
        : [];
    }
    return preference.daysBefore
      .map((days) => this.shiftDateKey(dueDate, -days))
      .filter((date) => date >= today)
      .map((date) =>
        this.indiaTimeToIso(
          date,
          preference.reminderHour,
          preference.reminderMinute,
        ),
      );
  }

  private indiaTimeToIso(dateKey: string, hour: number, minute: number) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(
      Date.UTC(year, month - 1, day, hour - 5, minute - 30),
    ).toISOString();
  }

  private indiaDateKey(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';
    return value('year') + '-' + value('month') + '-' + value('day');
  }

  private shiftDateKey(dateKey: string, days: number) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return date.toISOString().slice(0, 10);
  }

  private daysBetween(from: string, to: string) {
    return Math.round(
      (Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) /
        86_400_000,
    );
  }

  private monthKeysBetween(from: string, to: string) {
    const keys: string[] = [];
    let month = from.slice(0, 7);
    const last = to.slice(0, 7);
    while (month <= last) {
      keys.push(month);
      month = this.nextMonth(month);
    }
    return keys;
  }

  private nextMonth(month: string) {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
  }

  private monthStart(month: string) {
    return new Date(month + '-01T00:00:00.000Z');
  }

  private daysInMonth(month: string) {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  }

  private decimalToNumber(value: Prisma.Decimal) {
    return Number(value.toString());
  }

  private roundMoney(value: number) {
    return Number(value.toFixed(2));
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { LoanType, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async home(userId: string) {
    const user = await this.findUserWithLoans(userId);
    const monthlyIncome = this.decimalToNumber(user.monthlyIncome);
    const monthlyEssentialExpenses = this.decimalToNumber(
      user.monthlyEssentialExpenses,
    );
    const totalDebt = this.getTotalOutstandingDebt(user.loans);
    const totalMonthlyEmi = this.getTotalMonthlyEmi(user.loans);
    const paidOffAmount = this.estimatePaidOffAmount(user.loans);
    const originalDebtEstimate = totalDebt + paidOffAmount;
    const progressPercent =
      originalDebtEstimate > 0
        ? this.roundPercent((paidOffAmount / originalDebtEstimate) * 100)
        : 0;
    const freeCashAfterEssentials = Math.max(
      0,
      monthlyIncome - monthlyEssentialExpenses - totalMonthlyEmi,
    );
    const extraPayment = Math.min(freeCashAfterEssentials * 0.2, 5000);
    const debtFreeMonths = this.calculateMaxDebtFreeMonths(user.loans);

    return {
      success: true,
      dashboard: {
        user: {
          fullName: user.fullName,
        },
        overview: {
          totalDebt: this.roundMoney(originalDebtEstimate || totalDebt),
          activeLoanCount: user.loans.length,
          paidOffAmount: this.roundMoney(paidOffAmount),
          remainingAmount: this.roundMoney(totalDebt),
          progressPercent,
          debtFreeIn: {
            years: Math.floor(debtFreeMonths / 12),
            months: debtFreeMonths % 12,
            status: this.getDebtFreeStatus(progressPercent),
          },
        },
        upcomingPayment: this.getUpcomingPayment(user.loans),
        tip: {
          title: 'Nimmadhi Tip',
          message: 'Extra payments today, freedom tomorrow.',
        },
        loans: user.loans.map((loan) => this.toDashboardLoan(loan)),
      },
    };
  }

  async summary(userId: string) {
    const user = await this.findUserWithLoans(userId);

    const monthlyIncome = this.decimalToNumber(user.monthlyIncome);
    const totalOutstandingDebt = this.getTotalOutstandingDebt(user.loans);
    const totalMonthlyEmi = this.getTotalMonthlyEmi(user.loans);
    const emiToIncomeRatio =
      monthlyIncome > 0 ? (totalMonthlyEmi / monthlyIncome) * 100 : 0;

    return {
      success: true,
      summary: {
        monthlyIncome,
        totalOutstandingDebt,
        totalMonthlyEmi,
        freeCashAfterEmi: monthlyIncome - totalMonthlyEmi,
        emiToIncomeRatio: Number(emiToIncomeRatio.toFixed(2)),
        activeLoanCount: user.loans.length,
        riskLevel: this.getRiskLevel(emiToIncomeRatio),
        nextDueLoan: user.loans[0] ? this.toLoanSummary(user.loans[0]) : null,
      },
    };
  }

  private async findUserWithLoans(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        loans: {
          where: { isActive: true },
          orderBy: [{ dueDay: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private getTotalOutstandingDebt(
    loans: { outstandingAmount: Prisma.Decimal }[],
  ) {
    return loans.reduce(
      (total, loan) => total + this.decimalToNumber(loan.outstandingAmount),
      0,
    );
  }

  private getTotalMonthlyEmi(loans: { monthlyEmi: Prisma.Decimal }[]) {
    return loans.reduce(
      (total, loan) => total + this.decimalToNumber(loan.monthlyEmi),
      0,
    );
  }

  private estimatePaidOffAmount(
    loans: {
      outstandingAmount: Prisma.Decimal;
      monthlyEmi: Prisma.Decimal;
      tenureRemainingMonths: number | null;
    }[],
  ) {
    return loans.reduce((total, loan) => {
      const emi = this.decimalToNumber(loan.monthlyEmi);
      const remainingMonths = loan.tenureRemainingMonths ?? 0;
      const projectedRemainingPayment = emi * remainingMonths;
      const outstanding = this.decimalToNumber(loan.outstandingAmount);
      return total + Math.max(0, projectedRemainingPayment - outstanding);
    }, 0);
  }

  private decimalToNumber(value: Prisma.Decimal | null) {
    return value ? Number(value.toString()) : 0;
  }

  private roundMoney(value: number) {
    return Number(Math.max(0, value).toFixed(2));
  }

  private roundPercent(value: number) {
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  private getRiskLevel(emiToIncomeRatio: number) {
    if (emiToIncomeRatio <= 25) {
      return 'SAFE';
    }
    if (emiToIncomeRatio <= 40) {
      return 'CAUTION';
    }
    return 'HIGH_RISK';
  }

  private getDebtFreeStatus(progressPercent: number) {
    if (progressPercent >= 50) {
      return 'Ahead';
    }
    if (progressPercent >= 10) {
      return 'On track';
    }
    return 'Getting started';
  }

  private getUpcomingPayment(
    loans: {
      loanName: string;
      lenderName: string | null;
      monthlyEmi: Prisma.Decimal;
      dueDay: number;
    }[],
  ) {
    if (loans.length === 0) {
      return null;
    }

    const today = new Date();
    const currentDay = today.getDate();
    const loan = [...loans].sort(
      (a, b) =>
        this.getDueInDays(a.dueDay, currentDay) -
        this.getDueInDays(b.dueDay, currentDay),
    )[0];

    return {
      loanName: loan.loanName,
      lenderName: loan.lenderName,
      amount: this.decimalToNumber(loan.monthlyEmi),
      dueDay: loan.dueDay,
      dueInDays: this.getDueInDays(loan.dueDay, currentDay),
    };
  }

  private getDueInDays(dueDay: number, currentDay: number) {
    if (dueDay >= currentDay) {
      return dueDay - currentDay;
    }

    return 30 - currentDay + dueDay;
  }

  private toDashboardLoan(loan: {
    id: string;
    loanName: string;
    loanType: LoanType;
    lenderName: string | null;
    outstandingAmount: Prisma.Decimal;
    monthlyEmi: Prisma.Decimal;
    tenureRemainingMonths: number | null;
  }) {
    const outstandingAmount = this.decimalToNumber(loan.outstandingAmount);
    const projectedRemainingPayment =
      this.decimalToNumber(loan.monthlyEmi) * (loan.tenureRemainingMonths ?? 0);
    const progressBase = Math.max(outstandingAmount, projectedRemainingPayment);

    return {
      id: loan.id,
      loanName: loan.loanName,
      lenderName: loan.lenderName,
      loanType: loan.loanType,
      outstandingAmount,
      progressPercent:
        progressBase === 0
          ? 0
          : this.roundPercent(
              ((progressBase - outstandingAmount) / progressBase) * 100,
            ),
    };
  }

  private toLoanSummary(loan: {
    id: string;
    loanName: string;
    loanType: LoanType;
    lenderName: string | null;
    outstandingAmount: Prisma.Decimal;
    monthlyEmi: Prisma.Decimal;
    interestRate: Prisma.Decimal;
    dueDay: number;
    tenureRemainingMonths: number | null;
  }) {
    return {
      id: loan.id,
      loanName: loan.loanName,
      loanType: loan.loanType,
      lenderName: loan.lenderName,
      outstandingAmount: loan.outstandingAmount.toString(),
      monthlyEmi: loan.monthlyEmi.toString(),
      interestRate: loan.interestRate.toString(),
      dueDay: loan.dueDay,
      tenureRemainingMonths: loan.tenureRemainingMonths,
    };
  }

  private calculateMaxDebtFreeMonths(loans: any[]): number {
    if (!loans || loans.length === 0) return 0;
    let maxMonths = 0;

    for (const loan of loans) {
      const outstanding = this.decimalToNumber(loan.outstandingAmount);
      const emi = this.decimalToNumber(loan.monthlyEmi);
      const rate = this.decimalToNumber(loan.interestRate);

      if (loan.tenureRemainingMonths && loan.tenureRemainingMonths > 0) {
        maxMonths = Math.max(maxMonths, loan.tenureRemainingMonths);
      } else if (outstanding > 0 && emi > 0) {
        const ratePerMonth = (rate > 0 ? rate : 0) / 12 / 100;
        let balance = outstanding;
        let months = 0;
        while (balance > 0 && months < 600) {
          months += 1;
          const interest = ratePerMonth > 0 ? balance * ratePerMonth : 0;
          const principalPaid = Math.min(balance, Math.max(1, emi - interest));
          balance -= principalPaid;
        }
        maxMonths = Math.max(maxMonths, months);
      }
    }

    return maxMonths;
  }

}
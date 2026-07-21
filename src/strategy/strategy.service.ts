import { Injectable, NotFoundException } from '@nestjs/common';
import { LoanType } from '../../generated/prisma/client.js';
import {
  calculateSuggestedExtraPayment,
  decimalToNumber,
  FinanceLoan,
  roundMoney,
} from '../common/finance/finance-calculations.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RepaymentMethod } from './enums/repayment-method.enum.js';

@Injectable()
export class StrategyService {
  constructor(private readonly prisma: PrismaService) {}

  async getRepaymentPlan(userId: string, method: RepaymentMethod) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { loans: { where: { isActive: true } } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const loans = user.loans;
    const totalDebt = loans.reduce(
      (total, loan) => total + decimalToNumber(loan.outstandingAmount),
      0,
    );
    const totalMonthlyEmi = loans.reduce(
      (total, loan) => total + decimalToNumber(loan.monthlyEmi),
      0,
    );
    const monthlyIncome = decimalToNumber(user.monthlyIncome);
    const monthlyEssentialExpenses = decimalToNumber(
      user.monthlyEssentialExpenses,
    );
    const freeCashAfterEssentials = Math.max(
      0,
      monthlyIncome - monthlyEssentialExpenses - totalMonthlyEmi,
    );
    const suggestedExtraPayment = calculateSuggestedExtraPayment(
      freeCashAfterEssentials,
    );
    const monthlyDebtPayment = totalMonthlyEmi + suggestedExtraPayment;
    const estimatedDebtFreeMonths =
      totalDebt === 0 || monthlyDebtPayment <= 0
        ? 0
        : Math.ceil(totalDebt / monthlyDebtPayment);

    return {
      success: true,
      method,
      summary: {
        totalDebt: roundMoney(totalDebt),
        totalMonthlyEmi: roundMoney(totalMonthlyEmi),
        freeCashAfterEssentials: roundMoney(freeCashAfterEssentials),
        suggestedExtraPayment,
        estimatedDebtFreeMonths,
        estimatedDebtFreeDate: this.addMonthsFromNow(estimatedDebtFreeMonths),
      },
      payoffOrder: this.sortLoansForMethod(loans, method).map((loan, index) =>
        this.toPayoffLoan(loan, index + 1, method),
      ),
    };
  }

  sortLoansForMethod(loans: FinanceLoan[], method: RepaymentMethod) {
    const sortableLoans = [...loans];

    if (method === RepaymentMethod.SNOWBALL) {
      return sortableLoans.sort((a, b) => {
        const aHighInterestCard = this.isHighInterestCreditCard(a);
        const bHighInterestCard = this.isHighInterestCreditCard(b);
        if (aHighInterestCard !== bHighInterestCard) {
          return aHighInterestCard ? -1 : 1;
        }
        return (
          decimalToNumber(a.outstandingAmount) -
          decimalToNumber(b.outstandingAmount)
        );
      });
    }

    return sortableLoans.sort((a, b) => {
      const interestDifference =
        decimalToNumber(b.interestRate) - decimalToNumber(a.interestRate);
      if (interestDifference !== 0) {
        return interestDifference;
      }
      return (
        decimalToNumber(a.outstandingAmount) -
        decimalToNumber(b.outstandingAmount)
      );
    });
  }

  private isHighInterestCreditCard(loan: FinanceLoan) {
    return (
      loan.loanType === LoanType.CREDIT_CARD &&
      decimalToNumber(loan.interestRate) > 25
    );
  }

  private toPayoffLoan(
    loan: FinanceLoan,
    priority: number,
    method: RepaymentMethod,
  ) {
    const highInterestCard = this.isHighInterestCreditCard(loan);
    const reason = highInterestCard
      ? 'High-interest credit card debt should be cleared first.'
      : method === RepaymentMethod.AVALANCHE
        ? 'Highest interest debt. Clearing it reduces interest burden fastest.'
        : 'Smallest balance first. Clearing it can build repayment momentum.';

    return {
      priority,
      loanId: loan.id,
      loanName: loan.loanName,
      loanType: loan.loanType,
      outstandingAmount: decimalToNumber(loan.outstandingAmount),
      interestRate: decimalToNumber(loan.interestRate),
      monthlyEmi: decimalToNumber(loan.monthlyEmi),
      reason,
    };
  }

  private addMonthsFromNow(months: number) {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    date.setDate(1);
    return date.toISOString().slice(0, 10);
  }
}

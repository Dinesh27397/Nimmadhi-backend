import { Injectable, NotFoundException } from '@nestjs/common';
import { LoanType } from '../../generated/prisma/client.js';
import {
  calculateEmiRatio,
  calculateSuggestedExtraPayment,
  decimalToNumber,
  hasHighInterestCreditCard,
} from '../common/finance/finance-calculations.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Recommendation = {
  type: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  message: string;
  actionLabel: string;
};

@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  async today(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { loans: { where: { isActive: true } } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const monthlyIncome = decimalToNumber(user.monthlyIncome);
    const monthlyEssentialExpenses = decimalToNumber(
      user.monthlyEssentialExpenses,
    );
    const emergencyFund = decimalToNumber(user.emergencyFund);
    const totalMonthlyEmi = user.loans.reduce(
      (total, loan) => total + decimalToNumber(loan.monthlyEmi),
      0,
    );
    const emiRatio = calculateEmiRatio(totalMonthlyEmi, monthlyIncome);
    const freeCashAfterEssentials =
      monthlyIncome - monthlyEssentialExpenses - totalMonthlyEmi;
    const recommendations: Recommendation[] = [];

    if (emiRatio > 40) {
      recommendations.push({
        type: 'EMI_RISK',
        priority: 'HIGH',
        title: 'Your EMI burden is high',
        message: `Your EMI-to-income ratio is ${emiRatio}%. Avoid taking a new EMI for now.`,
        actionLabel: 'View debt health',
      });
    }

    const highInterestCard = user.loans.find(
      (loan) =>
        loan.loanType === LoanType.CREDIT_CARD &&
        decimalToNumber(loan.interestRate) > 25,
    );
    if (highInterestCard) {
      const extraPayment = calculateSuggestedExtraPayment(
        Math.max(0, freeCashAfterEssentials),
      );
      recommendations.push({
        type: 'HIGH_INTEREST_DEBT',
        priority: 'HIGH',
        title: 'Clear your credit card first',
        message: `Your credit card has ${decimalToNumber(highInterestCard.interestRate)}% interest. Paying ₹${extraPayment} extra can reduce your interest burden.`,
        actionLabel: 'View repayment plan',
      });
    }

    if (emergencyFund < monthlyEssentialExpenses) {
      recommendations.push({
        type: 'EMERGENCY_FUND',
        priority: 'MEDIUM',
        title: 'Build one month of safety money',
        message:
          'Your emergency fund is below one month of essential expenses. Build it gradually before adding new commitments.',
        actionLabel: 'Update financial profile',
      });
    }

    if (freeCashAfterEssentials <= 0) {
      recommendations.push({
        type: 'CASH_FLOW_RISK',
        priority: 'HIGH',
        title: 'Protect your monthly cash flow',
        message:
          'Your essential expenses and EMIs are using all available income. Pause optional spending and avoid new EMIs.',
        actionLabel: 'Review budget',
      });
    }

    if (user.loans.length === 0) {
      recommendations.push({
        type: 'NO_ACTIVE_DEBT',
        priority: 'LOW',
        title: 'You have no active loans',
        message:
          'Great work staying debt-free. Keep building savings and avoid unnecessary EMIs.',
        actionLabel: 'View dashboard',
      });
    }

    recommendations.push({
      type: 'MOTIVATION',
      priority: 'LOW',
      title: 'You have a clear plan',
      message:
        hasHighInterestCreditCard(user.loans) || user.loans.length > 0
          ? 'Small extra payments can move your debt-free date earlier.'
          : 'Your current position gives you room to plan calmly.',
      actionLabel: 'See your progress',
    });

    return {
      success: true,
      recommendations: recommendations.slice(0, 5),
    };
  }
}

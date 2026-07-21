import { Injectable, NotFoundException } from '@nestjs/common';
import {
  calculateEmiRatio,
  decimalToNumber,
  hasHighInterestCreditCard,
} from '../common/finance/finance-calculations.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CheckAffordabilityDto } from './dto/check-affordability.dto.js';

export type AffordabilityDecision = 'SAFE' | 'CAUTION' | 'NOT_RECOMMENDED';

@Injectable()
export class AffordabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async check(userId: string, dto: CheckAffordabilityDto) {
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
    const currentTotalEmi = user.loans.reduce(
      (total, loan) => total + decimalToNumber(loan.monthlyEmi),
      0,
    );
    const currentEmiRatio = calculateEmiRatio(currentTotalEmi, monthlyIncome);
    const newTotalEmi = currentTotalEmi + dto.monthlyEmi;
    const newEmiRatio = calculateEmiRatio(newTotalEmi, monthlyIncome);
    const freeCashAfterNewEmi =
      monthlyIncome - monthlyEssentialExpenses - newTotalEmi;
    const highInterestDebtExists = hasHighInterestCreditCard(user.loans);

    const decision = this.decide({
      newEmiRatio,
      freeCashAfterNewEmi,
      emergencyFund,
      monthlyEssentialExpenses,
      highInterestDebtExists,
    });

    return {
      success: true,
      decision,
      reason: this.getReason(decision, currentEmiRatio, newEmiRatio),
      currentEmiRatio,
      newEmiRatio,
      safeMonthlyEmiLimit: Math.round(monthlyIncome * 0.4),
      suggestedAction:
        decision === 'NOT_RECOMMENDED'
          ? 'Clear high-interest debt before adding a new EMI.'
          : 'Keep your EMI commitments within a comfortable limit.',
    };
  }

  decide(input: {
    newEmiRatio: number;
    freeCashAfterNewEmi: number;
    emergencyFund: number;
    monthlyEssentialExpenses: number;
    highInterestDebtExists: boolean;
  }): AffordabilityDecision {
    if (
      input.newEmiRatio > 40 ||
      input.freeCashAfterNewEmi < 0 ||
      input.highInterestDebtExists
    ) {
      return 'NOT_RECOMMENDED';
    }

    if (input.newEmiRatio > 30 && input.newEmiRatio <= 40) {
      return 'CAUTION';
    }

    if (
      input.newEmiRatio <= 30 &&
      input.freeCashAfterNewEmi > 0 &&
      input.emergencyFund >= input.monthlyEssentialExpenses
    ) {
      return 'SAFE';
    }

    return 'CAUTION';
  }

  private getReason(
    decision: AffordabilityDecision,
    currentEmiRatio: number,
    newEmiRatio: number,
  ) {
    if (decision === 'NOT_RECOMMENDED') {
      return `Your EMI-to-income ratio will rise from ${currentEmiRatio}% to ${newEmiRatio}%. Keep it under 40%.`;
    }
    if (decision === 'CAUTION') {
      return `Your EMI-to-income ratio will become ${newEmiRatio}%. This is manageable but needs caution.`;
    }
    return `Your EMI-to-income ratio will be ${newEmiRatio}%, and your cash flow remains positive.`;
  }
}

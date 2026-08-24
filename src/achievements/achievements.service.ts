import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { decimalToNumber } from '../common/finance/finance-calculations.js';
import { BADGE_CATALOG } from './badge-definitions.js';

@Injectable()
export class AchievementsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserAchievements(userId: string) {
    // Auto-evaluate first so new badges are computed
    await this.evaluate(userId);

    const unlocked = await (this.prisma as any).userAchievement.findMany({
      where: { userId },
      orderBy: { unlockedAt: 'desc' },
    });

    return {
      unlocked,
      catalog: BADGE_CATALOG,
      totalUnlocked: unlocked.length,
      totalAvailable: BADGE_CATALOG.length,
    };
  }

  async evaluate(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { loans: true },
    });

    if (!user) {
      return [];
    }

    const existing = await (this.prisma as any).userAchievement.findMany({
      where: { userId },
    });
    const existingKeys = new Set(existing.map((a: any) => a.badgeKey));

    const loans = user.loans;
    const activeLoans = loans.filter(
      (l) => l.isActive && decimalToNumber(l.outstandingAmount) > 0,
    );
    const closedLoans = loans.filter(
      (l) => !l.isActive || decimalToNumber(l.outstandingAmount) <= 0,
    );

    const newlyEarned: string[] = [];

    // Milestones
    if (!existingKeys.has('FIRST_LOAN_ADDED') && loans.length >= 1) {
      newlyEarned.push('FIRST_LOAN_ADDED');
    }
    if (!existingKeys.has('THREE_LOANS_TRACKED') && loans.length >= 3) {
      newlyEarned.push('THREE_LOANS_TRACKED');
    }
    if (!existingKeys.has('FIRST_LOAN_CLOSED') && closedLoans.length >= 1) {
      newlyEarned.push('FIRST_LOAN_CLOSED');
    }
    if (!existingKeys.has('ALL_LOANS_CLOSED') && loans.length > 0 && activeLoans.length === 0) {
      newlyEarned.push('ALL_LOANS_CLOSED');
    }

    // Streaks
    if (!existingKeys.has('EMI_STREAK_3') && loans.length >= 1) {
      newlyEarned.push('EMI_STREAK_3');
    }
    if (!existingKeys.has('EMI_STREAK_6') && (loans.length >= 2 || closedLoans.length >= 1)) {
      newlyEarned.push('EMI_STREAK_6');
    }
    if (!existingKeys.has('EMI_STREAK_12') && closedLoans.length >= 1) {
      newlyEarned.push('EMI_STREAK_12');
    }

    // Savings
    if (!existingKeys.has('SAVED_10K') && closedLoans.length >= 1) {
      newlyEarned.push('SAVED_10K');
    }
    if (!existingKeys.has('SAVED_50K') && closedLoans.length >= 1) {
      newlyEarned.push('SAVED_50K');
    }
    if (!existingKeys.has('SAVED_1L') && closedLoans.length >= 2) {
      newlyEarned.push('SAVED_1L');
    }

    // Speed & Profile
    if (!existingKeys.has('FIRST_PREPAYMENT') && closedLoans.length >= 1) {
      newlyEarned.push('FIRST_PREPAYMENT');
    }
    if (!existingKeys.has('PROFILE_COMPLETE') && user.fullName && decimalToNumber(user.monthlyIncome) > 0) {
      newlyEarned.push('PROFILE_COMPLETE');
    }
    if (!existingKeys.has('STRATEGY_ACTIVATED') && loans.length >= 1) {
      newlyEarned.push('STRATEGY_ACTIVATED');
    }
    if (!existingKeys.has('APP_OPENED_7_DAYS') && loans.length >= 1) {
      newlyEarned.push('APP_OPENED_7_DAYS');
    }

    if (newlyEarned.length === 0) {
      return [];
    }

    const createdRecords = [];
    for (const key of newlyEarned) {
      const record = await (this.prisma as any).userAchievement.create({
        data: {
          userId,
          badgeKey: key,
          unlockedAt: new Date(),
          seen: false,
        },
      });
      createdRecords.push(record);
    }

    return createdRecords;
  }

  async markSeen(userId: string, badgeKeys: string[]) {
    if (!badgeKeys || badgeKeys.length === 0) {
      return;
    }
    await (this.prisma as any).userAchievement.updateMany({
      where: {
        userId,
        badgeKey: { in: badgeKeys },
      },
      data: { seen: true },
    });
  }
}

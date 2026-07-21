import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { decimalToNumber } from '../common/finance/finance-calculations.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateFinancialProfileDto } from './dto/update-financial-profile.dto.js';

@Injectable()
export class FinancialProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.findUser(userId);

    return {
      success: true,
      financialProfile: this.toFinancialProfile(user),
    };
  }

  async updateProfile(userId: string, dto: UpdateFinancialProfileDto) {
    await this.findUser(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        monthlyIncome: new Prisma.Decimal(dto.monthlyIncome),
        monthlyEssentialExpenses: new Prisma.Decimal(
          dto.monthlyEssentialExpenses,
        ),
        emergencyFund: new Prisma.Decimal(dto.emergencyFund),
      },
    });

    return {
      success: true,
      message: 'Financial profile updated',
      financialProfile: this.toFinancialProfile(user),
    };
  }

  private async findUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private toFinancialProfile(user: {
    id: string;
    mobile: string;
    monthlyIncome: Prisma.Decimal | null;
    monthlyEssentialExpenses: Prisma.Decimal | null;
    emergencyFund: Prisma.Decimal | null;
  }) {
    return {
      userId: user.id,
      mobile: user.mobile,
      monthlyIncome: decimalToNumber(user.monthlyIncome),
      monthlyEssentialExpenses: decimalToNumber(user.monthlyEssentialExpenses),
      emergencyFund: decimalToNumber(user.emergencyFund),
    };
  }
}

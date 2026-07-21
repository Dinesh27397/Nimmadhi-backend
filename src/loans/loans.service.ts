import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LoanType, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateLoanDto } from './dto/create-loan.dto.js';
import { UpdateLoanDto } from './dto/update-loan.dto.js';

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateLoanDto) {
    const input = this.normalizeCreateInput(dto);

    const loan = await this.prisma.loan.create({
      data: {
        userId,
        loanName: input.loanName,
        loanType: input.loanType,
        lenderName: input.lenderName,
        outstandingAmount: new Prisma.Decimal(dto.outstandingAmount),
        monthlyEmi: new Prisma.Decimal(input.monthlyEmi),
        interestRate: new Prisma.Decimal(input.interestRate),
        dueDay: input.dueDay,
        tenureRemainingMonths: dto.tenureRemainingMonths,
      },
    });

    return this.toLoanResponse(loan);
  }

  async findAll(userId: string) {
    const loans = await this.prisma.loan.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return loans.map((loan) => this.toLoanResponse(loan));
  }

  async findOne(userId: string, id: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id, userId, isActive: true },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    return this.toLoanResponse(loan);
  }

  async update(userId: string, id: string, dto: UpdateLoanDto) {
    const existingLoan = await this.prisma.loan.findFirst({
      where: { id, userId, isActive: true },
    });
    if (!existingLoan) {
      throw new NotFoundException('Loan not found');
    }

    const loan = await this.prisma.loan.update({
      where: { id },
      data: {
        loanName: dto.loanName ?? dto.name,
        loanType:
          dto.loanType ??
          (dto.type === undefined
            ? undefined
            : this.toPrismaLoanType(dto.type)),
        lenderName: dto.lenderName ?? dto.lender,
        outstandingAmount:
          dto.outstandingAmount === undefined
            ? undefined
            : new Prisma.Decimal(dto.outstandingAmount),
        monthlyEmi:
          dto.monthlyEmi === undefined && dto.emiAmount === undefined
            ? undefined
            : new Prisma.Decimal(dto.monthlyEmi ?? dto.emiAmount ?? 0),
        interestRate:
          dto.interestRate === undefined
            ? undefined
            : new Prisma.Decimal(dto.interestRate),
        dueDay:
          dto.dueDay ??
          (dto.dueDate === undefined
            ? undefined
            : this.parseDueDay(dto.dueDate)),
        tenureRemainingMonths: dto.tenureRemainingMonths,
      },
    });

    return this.toLoanResponse(loan);
  }

  async remove(userId: string, id: string) {
    const existingLoan = await this.prisma.loan.findFirst({
      where: { id, userId, isActive: true },
    });
    if (!existingLoan) {
      throw new NotFoundException('Loan not found');
    }

    await this.prisma.loan.update({
      where: { id },
      data: { isActive: false },
    });

    return {
      success: true,
      message: 'Loan deleted',
    };
  }

  private normalizeCreateInput(dto: CreateLoanDto) {
    return {
      loanName: dto.loanName ?? dto.name ?? '',
      loanType: dto.loanType ?? this.toPrismaLoanType(dto.type ?? 'OTHER'),
      lenderName: dto.lenderName ?? dto.lender,
      monthlyEmi: dto.monthlyEmi ?? dto.emiAmount ?? 0,
      interestRate: dto.interestRate ?? 0,
      dueDay: dto.dueDay ?? this.parseDueDay(dto.dueDate),
    };
  }

  private toPrismaLoanType(type: string): LoanType {
    const types: Record<string, LoanType> = {
      PERSONAL: LoanType.PERSONAL_LOAN,
      CREDIT_CARD: LoanType.CREDIT_CARD,
      HOME: LoanType.HOME_LOAN,
      VEHICLE: LoanType.VEHICLE_LOAN,
      EDUCATION: LoanType.EDUCATION_LOAN,
      OTHER: LoanType.OTHER,
    };
    return types[type] ?? LoanType.OTHER;
  }

  private parseDueDay(dueDate?: string) {
    if (!dueDate) {
      return 1;
    }
    if (/^\d{1,2}$/.test(dueDate)) {
      const day = Number(dueDate);
      if (day >= 1 && day <= 31) {
        return day;
      }
    }
    const parsed = new Date(dueDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getUTCDate();
    }
    throw new BadRequestException('dueDate must contain a valid date');
  }

  private toLoanResponse(loan: {
    id: string;
    userId: string;
    loanName: string;
    loanType: LoanType;
    lenderName: string | null;
    outstandingAmount: Prisma.Decimal;
    monthlyEmi: Prisma.Decimal;
    interestRate: Prisma.Decimal;
    dueDay: number;
    tenureRemainingMonths: number | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: loan.id,
      name: loan.loanName,
      lender: loan.lenderName ?? undefined,
      type: this.toMobileLoanType(loan.loanType),
      outstandingAmount: Number(loan.outstandingAmount.toString()),
      emiAmount: Number(loan.monthlyEmi.toString()),
      interestRate: Number(loan.interestRate.toString()),
      dueDate: String(loan.dueDay),
      isActive: loan.isActive,
    };
  }

  private toMobileLoanType(type: LoanType) {
    const types: Partial<Record<LoanType, string>> = {
      [LoanType.PERSONAL_LOAN]: 'PERSONAL',
      [LoanType.CREDIT_CARD]: 'CREDIT_CARD',
      [LoanType.HOME_LOAN]: 'HOME',
      [LoanType.VEHICLE_LOAN]: 'VEHICLE',
      [LoanType.EDUCATION_LOAN]: 'EDUCATION',
    };
    return types[type] ?? 'OTHER';
  }
}

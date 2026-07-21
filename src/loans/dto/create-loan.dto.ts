import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export enum LoanTypeDto {
  HOME_LOAN = 'HOME_LOAN',
  PERSONAL_LOAN = 'PERSONAL_LOAN',
  VEHICLE_LOAN = 'VEHICLE_LOAN',
  GOLD_LOAN = 'GOLD_LOAN',
  CREDIT_CARD = 'CREDIT_CARD',
  EDUCATION_LOAN = 'EDUCATION_LOAN',
  KADAN = 'KADAN',
  OTHER = 'OTHER',
}

export class CreateLoanDto {
  @ApiPropertyOptional({ example: '9876543210', deprecated: true })
  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Enter a valid 10-digit Indian mobile number',
  })
  mobile?: string;

  @ApiPropertyOptional({ example: 'Personal Loan' })
  @ValidateIf((dto: CreateLoanDto) => dto.name === undefined)
  @IsString()
  @IsNotEmpty()
  loanName?: string;

  @ApiPropertyOptional({ example: 'Personal Loan' })
  @ValidateIf((dto: CreateLoanDto) => dto.loanName === undefined)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    enum: LoanTypeDto,
    example: LoanTypeDto.PERSONAL_LOAN,
  })
  @IsOptional()
  @IsEnum(LoanTypeDto)
  loanType?: LoanTypeDto;

  @ApiPropertyOptional({
    enum: ['PERSONAL', 'CREDIT_CARD', 'HOME', 'VEHICLE', 'EDUCATION', 'OTHER'],
  })
  @IsOptional()
  @IsIn(['PERSONAL', 'CREDIT_CARD', 'HOME', 'VEHICLE', 'EDUCATION', 'OTHER'])
  type?: string;

  @ApiPropertyOptional({ example: 'HDFC Bank' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lenderName?: string;

  @ApiPropertyOptional({ example: 'HDFC Bank' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lender?: string;

  @ApiProperty({ example: 250000 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  outstandingAmount: number;

  @ApiPropertyOptional({ example: 8500 })
  @ValidateIf((dto: CreateLoanDto) => dto.emiAmount === undefined)
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  monthlyEmi?: number;

  @ApiPropertyOptional({ example: 8500 })
  @ValidateIf((dto: CreateLoanDto) => dto.monthlyEmi === undefined)
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  emiAmount?: number;

  @ApiPropertyOptional({ example: 14.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;

  @ApiPropertyOptional({ example: '2026-08-05' })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 36 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  tenureRemainingMonths?: number;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO4217CurrencyCode,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  TransactionCategory,
  TransactionSource,
  TransactionStatus,
  TransactionType,
} from '../../../generated/prisma/client.js';

export class CreateTransactionDto {
  @ApiProperty({ example: 'Home Loan EMI' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({ example: 'SBI Home Loan •••• 4567' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  description?: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EMI })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({
    enum: TransactionCategory,
    example: TransactionCategory.LOAN,
  })
  @IsEnum(TransactionCategory)
  category: TransactionCategory;

  @ApiPropertyOptional({
    enum: TransactionStatus,
    default: TransactionStatus.SUCCESS,
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({
    enum: TransactionSource,
    default: TransactionSource.MANUAL,
  })
  @IsOptional()
  @IsEnum(TransactionSource)
  source?: TransactionSource;

  @ApiProperty({ example: 18750 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: 'INR', default: 'INR' })
  @IsOptional()
  @IsISO4217CurrencyCode()
  currency?: string;

  @ApiProperty({ example: '2026-07-20T08:30:00.000Z' })
  @IsISO8601({ strict: true })
  occurredAt: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  loanId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  originalTransactionId?: string;

  @ApiPropertyOptional({ example: 'SBI Home Loan' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  merchantName?: string;

  @ApiPropertyOptional({ example: '•••• 4567' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  accountLabel?: string;

  @ApiPropertyOptional({ example: 'UTR123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @ApiPropertyOptional({
    description: 'Idempotency key supplied by an import or payment provider',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  externalReference?: string;
}

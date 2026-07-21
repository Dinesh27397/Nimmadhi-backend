import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class UpdateFinancialProfileDto {
  @ApiProperty({ example: 90000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyIncome: number;

  @ApiProperty({ example: 25000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyEssentialExpenses: number;

  @ApiProperty({ example: 50000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  emergencyFund: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { RepaymentMethod } from '../enums/repayment-method.enum.js';

export class StrategyQueryDto {
  @ApiProperty({ enum: RepaymentMethod, example: RepaymentMethod.AVALANCHE })
  @IsEnum(RepaymentMethod)
  method: RepaymentMethod;
}

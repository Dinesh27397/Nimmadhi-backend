import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class PaymentCalendarQueryDto {
  @ApiPropertyOptional({
    example: '2026-07',
    description: 'Calendar month in YYYY-MM format; defaults to current month',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must use YYYY-MM format',
  })
  month?: string;
}

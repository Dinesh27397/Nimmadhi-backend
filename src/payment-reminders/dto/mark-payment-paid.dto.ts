import { IsNumber, IsOptional, Matches, Min } from 'class-validator';

export class MarkPaymentPaidDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;
}

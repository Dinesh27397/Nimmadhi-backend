import { IsBoolean } from 'class-validator';

export class UpdateLoanReminderDto {
  @IsBoolean()
  enabled!: boolean;
}

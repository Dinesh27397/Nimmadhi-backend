import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateLoanDto } from './create-loan.dto.js';

export class UpdateLoanDto extends PartialType(
  OmitType(CreateLoanDto, ['mobile'] as const),
) {}

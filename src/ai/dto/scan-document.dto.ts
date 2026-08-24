import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ScanStatementRequestDto {
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @IsString()
  @IsOptional()
  mimeType?: string;
}

export class ExtractedLoanDetailsDto {
  lenderName: string;
  loanName: string;
  loanType: 'HOME' | 'VEHICLE' | 'PERSONAL' | 'EDUCATION' | 'GOLD' | 'CREDIT_CARD' | 'OTHER';
  originalAmount?: number;
  outstandingAmount: number;
  monthlyEmi: number;
  interestRate?: number;
  dueDay: number;
  tenureRemainingMonths?: number;
  accountNumberMasked?: string;
  statementDate?: string;
  confidence: number;
  notes?: string;
}

export class ScanStatementResponseDto {
  success: boolean;
  extracted: ExtractedLoanDetailsDto;
  rawSummary?: string;
}

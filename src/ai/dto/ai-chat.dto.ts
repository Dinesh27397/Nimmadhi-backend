import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ExtractedLoanDetailsDto } from './scan-document.dto.js';

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  sender: 'user' | 'coach' | 'system';

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsOptional()
  timestamp?: string;
}

export class AiChatRequestDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsArray()
  @IsOptional()
  history?: ChatMessageDto[];

  @IsString()
  @IsOptional()
  attachmentBase64?: string;

  @IsString()
  @IsOptional()
  attachmentName?: string;

  @IsString()
  @IsOptional()
  attachmentText?: string;
}

export class AiActionPayload {
  @IsString()
  @IsNotEmpty()
  type: 'SIMULATION' | 'AFFORDABILITY' | 'STRATEGY' | 'ADD_LOAN';

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  loanId?: string;

  @IsString()
  @IsOptional()
  loanName?: string;

  @IsOptional()
  extraMonthly?: number;

  @IsOptional()
  lumpSum?: number;

  @IsOptional()
  purchaseAmount?: number;

  @IsOptional()
  tenureMonths?: number;

  @IsOptional()
  strategy?: 'AVALANCHE' | 'SNOWBALL';

  @IsOptional()
  extractedLoan?: ExtractedLoanDetailsDto;
}

export class AiChatResponseDto {
  reply: string;
  action?: AiActionPayload;
  contextSummary?: {
    totalDebt: number;
    totalMonthlyEmi: number;
    activeLoanCount: number;
  };
}

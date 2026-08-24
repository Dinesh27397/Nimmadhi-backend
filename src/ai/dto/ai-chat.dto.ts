import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  sender: 'user' | 'coach';

  @IsString()
  @IsNotEmpty()
  text: string;
}

export class AiChatRequestDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsArray()
  @IsOptional()
  history?: ChatMessageDto[];
}

export class AiActionPayload {
  type: 'SIMULATION' | 'AFFORDABILITY' | 'STRATEGY' | 'SCAN_STATEMENT';
  title: string;
  loanId?: string;
  loanName?: string;
  extraMonthly?: number;
  lumpSum?: number;
  purchaseAmount?: number;
  tenureMonths?: number;
  strategy?: 'AVALANCHE' | 'SNOWBALL';
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

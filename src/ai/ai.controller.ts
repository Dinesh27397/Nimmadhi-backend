import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AiService } from './ai.service.js';
import { AiChatRequestDto, AiChatResponseDto } from './dto/ai-chat.dto.js';
import {
  ScanStatementRequestDto,
  ScanStatementResponseDto,
} from './dto/scan-document.dto.js';

@ApiTags('ai')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('copilot/chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chat with context-aware Gemini AI Financial Copilot' })
  @ApiResponse({ status: 200, type: AiChatResponseDto })
  async chatWithCopilot(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AiChatRequestDto,
  ): Promise<AiChatResponseDto> {
    const userId = user?.sub || (user as any)?.id;
    return this.aiService.chatWithCopilot(userId, dto);
  }

  @Post('scan-statement')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Extract loan and bill details via Gemini Vision OCR' })
  @ApiResponse({ status: 200, type: ScanStatementResponseDto })
  async scanStatement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ScanStatementRequestDto,
  ): Promise<ScanStatementResponseDto> {
    const userId = user?.sub || (user as any)?.id;
    return this.aiService.scanStatement(userId, dto);
  }
}

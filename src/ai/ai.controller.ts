import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AiService } from './ai.service.js';
import { AiChatRequestDto, AiChatResponseDto } from './dto/ai-chat.dto.js';
import {
  ScanStatementRequestDto,
  ScanStatementResponseDto,
} from './dto/scan-document.dto.js';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('copilot/chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chat with context-aware Gemini AI Financial Copilot' })
  @ApiResponse({ status: 200, type: AiChatResponseDto })
  async chatWithCopilot(
    @Request() req: any,
    @Body() dto: AiChatRequestDto,
  ): Promise<AiChatResponseDto> {
    return this.aiService.chatWithCopilot(req.user.id, dto);
  }

  @Post('scan-statement')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Extract loan and bill details via Gemini Vision OCR' })
  @ApiResponse({ status: 200, type: ScanStatementResponseDto })
  async scanStatement(
    @Request() req: any,
    @Body() dto: ScanStatementRequestDto,
  ): Promise<ScanStatementResponseDto> {
    return this.aiService.scanStatement(req.user.id, dto);
  }
}

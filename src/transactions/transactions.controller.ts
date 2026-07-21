import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { TransactionOverviewQueryDto } from './dto/transaction-overview-query.dto.js';
import { TransactionQueryDto } from './dto/transaction-query.dto.js';
import { UpdateTransactionDto } from './dto/update-transaction.dto.js';
import { EmailProvider } from '../../generated/prisma/client.js';
import { EmailProviderDto } from './dto/email-provider.dto.js';
import { EmailImportsService } from './email-imports.service.js';
import { ImportSmsDto } from './dto/import-sms.dto.js';
import { ReviewSmsImportDto } from './dto/review-sms-import.dto.js';
import { SmsImportQueryDto } from './dto/sms-import-query.dto.js';
import { SmsImportsService } from './sms-imports.service.js';
import { TransactionsService } from './transactions.service.js';

@ApiTags('Transactions')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly smsImportsService: SmsImportsService,
    private readonly emailImportsService: EmailImportsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a transaction for the logged-in user' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionsService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List and filter the logged-in user transactions' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TransactionQueryDto,
  ) {
    return this.transactionsService.findAll(user.sub, query);
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Get totals, breakdown, trend, and recent activity',
  })
  overview(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TransactionOverviewQueryDto,
  ) {
    return this.transactionsService.overview(user.sub, query);
  }

  @Post('sms/import')
  @ApiOperation({
    summary: 'Parse and import financial SMS messages for the logged-in user',
  })
  importSms(@CurrentUser() user: AuthenticatedUser, @Body() dto: ImportSmsDto) {
    return this.smsImportsService.importMessages(user.sub, dto);
  }

  @Get('imports')
  @ApiOperation({ summary: 'List SMS import candidates and review status' })
  findImports(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SmsImportQueryDto,
  ) {
    return this.smsImportsService.findAll(user.sub, query);
  }

  @Patch('imports/:id/review')
  @ApiOperation({ summary: 'Approve, edit, or ignore an SMS import candidate' })
  reviewImport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewSmsImportDto,
  ) {
    return this.smsImportsService.review(user.sub, id, dto);
  }

  @Post('email/connect')
  @ApiOperation({ summary: 'Start Gmail or Outlook OAuth connection' })
  connectEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EmailProviderDto,
  ) {
    return this.emailImportsService.connect(user.sub, dto.provider);
  }

  @Get('email/status')
  @ApiOperation({ summary: 'Get connected email providers and sync status' })
  emailStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.emailImportsService.status(user.sub);
  }

  @Post('email/sync')
  @ApiOperation({ summary: 'Sync financial emails from one provider' })
  syncEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EmailProviderDto,
  ) {
    return this.emailImportsService.sync(user.sub, dto.provider);
  }

  @Delete('email/connection/:provider')
  @ApiOperation({ summary: 'Disconnect an email provider' })
  disconnectEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provider', new ParseEnumPipe(EmailProvider))
    provider: EmailProvider,
  ) {
    return this.emailImportsService.disconnect(user.sub, provider);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one transaction' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.transactionsService.findOne(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update one transaction' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete one transaction' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.transactionsService.remove(user.sub, id);
  }
}

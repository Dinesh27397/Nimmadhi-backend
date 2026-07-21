import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { MarkPaymentPaidDto } from './dto/mark-payment-paid.dto.js';
import { ReminderQueryDto } from './dto/reminder-query.dto.js';
import { UpdateLoanReminderDto } from './dto/update-loan-reminder.dto.js';
import { UpdateReminderPreferencesDto } from './dto/update-reminder-preferences.dto.js';
import { PaymentRemindersService } from './payment-reminders.service.js';

@ApiTags('Payment Reminders')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('payment-reminders')
export class PaymentRemindersController {
  constructor(private readonly reminders: PaymentRemindersService) {}

  @Get('preferences')
  @ApiOperation({ summary: 'Get reminder settings and per-loan overrides' })
  preferences(@CurrentUser() user: AuthenticatedUser) {
    return this.reminders.getPreferences(user.sub);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update reminder settings' })
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateReminderPreferencesDto,
  ) {
    return this.reminders.updatePreferences(user.sub, dto);
  }

  @Put('preferences/loans/:loanId')
  @ApiOperation({ summary: 'Enable or disable reminders for one loan' })
  updateLoan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('loanId') loanId: string,
    @Body() dto: UpdateLoanReminderDto,
  ) {
    return this.reminders.updateLoanPreference(user.sub, loanId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get upcoming, overdue and paid reminder items' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReminderQueryDto,
  ) {
    return this.reminders.getReminders(user.sub, query);
  }

  @Post(':loanId/mark-paid')
  @ApiOperation({ summary: 'Record an EMI payment from a reminder' })
  markPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('loanId') loanId: string,
    @Body() dto: MarkPaymentPaidDto,
  ) {
    return this.reminders.markPaid(user.sub, loanId, dto);
  }
}

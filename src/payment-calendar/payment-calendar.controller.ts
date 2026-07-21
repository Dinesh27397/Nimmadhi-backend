import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { PaymentCalendarQueryDto } from './dto/payment-calendar-query.dto.js';
import { PaymentCalendarService } from './payment-calendar.service.js';

@ApiTags('Payment Calendar')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('payment-calendar')
export class PaymentCalendarController {
  constructor(
    private readonly paymentCalendarService: PaymentCalendarService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get scheduled loan payments for one month' })
  findMonth(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaymentCalendarQueryDto,
  ) {
    return this.paymentCalendarService.findMonth(user.sub, query.month);
  }
}

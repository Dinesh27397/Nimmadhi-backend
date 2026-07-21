import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { StrategyQueryDto } from './dto/strategy-query.dto.js';
import { StrategyService } from './strategy.service.js';

@ApiTags('Debt Strategy')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('strategy')
export class StrategyController {
  constructor(private readonly strategyService: StrategyService) {}

  @Get('repayment-plan')
  @ApiOperation({ summary: 'Generate deterministic repayment plan' })
  repaymentPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StrategyQueryDto,
  ) {
    // Controllers read request data; services calculate and query Prisma.
    return this.strategyService.getRepaymentPlan(user.sub, query.method);
  }
}

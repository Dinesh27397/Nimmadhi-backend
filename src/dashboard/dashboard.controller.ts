import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Get debt dashboard summary for the logged-in user',
  })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.summary(user.sub);
  }

  @Get('home')
  @ApiOperation({ summary: 'Get mobile home dashboard data' })
  home(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.home(user.sub);
  }
}

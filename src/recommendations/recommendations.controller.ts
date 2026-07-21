import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { RecommendationsService } from './recommendations.service.js';

@ApiTags('Recommendations')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('today')
  @ApiOperation({ summary: 'Get up to five rule-based recommendations' })
  today(@CurrentUser() user: AuthenticatedUser) {
    return this.recommendationsService.today(user.sub);
  }
}

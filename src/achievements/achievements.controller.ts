import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { AchievementsService } from './achievements.service.js';

@ApiTags('Achievements')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all achievements (unlocked & locked)' })
  async getAchievements(@CurrentUser() user: AuthenticatedUser) {
    return this.achievementsService.getUserAchievements(user.sub);
  }

  @Post('evaluate')
  @ApiOperation({ summary: 'Re-evaluate achievements for current user' })
  async evaluate(@CurrentUser() user: AuthenticatedUser) {
    const newBadges = await this.achievementsService.evaluate(user.sub);
    return { newBadges };
  }

  @Patch('seen')
  @ApiOperation({ summary: 'Mark achievement badges as seen' })
  async markSeen(
    @CurrentUser() user: AuthenticatedUser,
    @Body('badgeKeys') badgeKeys: string[],
  ) {
    await this.achievementsService.markSeen(user.sub, badgeKeys);
    return { success: true };
  }
}

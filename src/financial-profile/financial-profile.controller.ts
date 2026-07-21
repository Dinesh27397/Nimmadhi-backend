import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { UpdateFinancialProfileDto } from './dto/update-financial-profile.dto.js';
import { FinancialProfileService } from './financial-profile.service.js';

@ApiTags('Financial Profile')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('financial-profile')
export class FinancialProfileController {
  constructor(
    private readonly financialProfileService: FinancialProfileService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get logged-in user financial profile' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.financialProfileService.getProfile(user.sub);
  }

  @Put()
  @ApiOperation({ summary: 'Update logged-in user financial profile' })
  @ApiBody({ type: UpdateFinancialProfileDto })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFinancialProfileDto,
  ) {
    // Controller receives HTTP input; service owns the Prisma database work.
    return this.financialProfileService.updateProfile(user.sub, dto);
  }
}

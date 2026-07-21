import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { AffordabilityService } from './affordability.service.js';
import { CheckAffordabilityDto } from './dto/check-affordability.dto.js';

@ApiTags('Affordability')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('affordability')
export class AffordabilityController {
  constructor(private readonly affordabilityService: AffordabilityService) {}

  @Post('check')
  @ApiOperation({ summary: 'Check whether a new EMI is affordable' })
  @ApiBody({ type: CheckAffordabilityDto })
  check(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckAffordabilityDto,
  ) {
    return this.affordabilityService.check(user.sub, dto);
  }
}

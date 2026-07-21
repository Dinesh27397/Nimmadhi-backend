import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateLoanDto } from './dto/create-loan.dto.js';
import { UpdateLoanDto } from './dto/update-loan.dto.js';
import { LoansService } from './loans.service.js';

@ApiTags('Loans')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  @ApiOperation({ summary: 'Create a loan for the logged-in user' })
  @ApiBody({ type: CreateLoanDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLoanDto) {
    return this.loansService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List active loans for the logged-in user' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.loansService.findAll(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one active loan by id' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.loansService.findOne(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a loan by id' })
  @ApiBody({ type: UpdateLoanDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLoanDto,
  ) {
    return this.loansService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a loan by id' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.loansService.remove(user.sub, id);
  }
}

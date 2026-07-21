import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { FinancialProfileController } from './financial-profile.controller.js';
import { FinancialProfileService } from './financial-profile.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [FinancialProfileController],
  providers: [FinancialProfileService],
})
export class FinancialProfileModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AffordabilityController } from './affordability.controller.js';
import { AffordabilityService } from './affordability.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AffordabilityController],
  providers: [AffordabilityService],
})
export class AffordabilityModule {}

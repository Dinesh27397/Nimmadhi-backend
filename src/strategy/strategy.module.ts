import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StrategyController } from './strategy.controller.js';
import { StrategyService } from './strategy.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [StrategyController],
  providers: [StrategyService],
})
export class StrategyModule {}

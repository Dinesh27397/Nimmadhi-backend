import { Module } from '@nestjs/common';
import { AchievementsController } from './achievements.controller.js';
import { AchievementsService } from './achievements.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [AchievementsController],
  providers: [AchievementsService],
  exports: [AchievementsService],
})
export class AchievementsModule {}

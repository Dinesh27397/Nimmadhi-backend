import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PaymentCalendarController } from './payment-calendar.controller.js';
import { PaymentCalendarService } from './payment-calendar.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentCalendarController],
  providers: [PaymentCalendarService],
  exports: [PaymentCalendarService],
})
export class PaymentCalendarModule {}

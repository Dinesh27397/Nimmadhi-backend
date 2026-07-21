import { Module } from '@nestjs/common';
import { PaymentRemindersController } from './payment-reminders.controller.js';
import { PaymentRemindersService } from './payment-reminders.service.js';

@Module({
  controllers: [PaymentRemindersController],
  providers: [PaymentRemindersService],
})
export class PaymentRemindersModule {}

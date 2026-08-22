import { Module } from '@nestjs/common';
import { AffordabilityModule } from './affordability/affordability.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { FinancialProfileModule } from './financial-profile/financial-profile.module.js';
import { LoansModule } from './loans/loans.module.js';
import { PaymentCalendarModule } from './payment-calendar/payment-calendar.module.js';
import { PaymentRemindersModule } from './payment-reminders/payment-reminders.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RecommendationsModule } from './recommendations/recommendations.module.js';
import { StrategyModule } from './strategy/strategy.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { UsersModule } from './users/users.module.js';
import { FirebaseModule } from './firebase/firebase.module.js';

@Module({
  imports: [
    AffordabilityModule,
    AuthModule,
    DashboardModule,
    FinancialProfileModule,
    LoansModule,
    PaymentCalendarModule,
    PaymentRemindersModule,
    PrismaModule,
    RecommendationsModule,
    StrategyModule,
    TransactionsModule,
    UsersModule,
    FirebaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

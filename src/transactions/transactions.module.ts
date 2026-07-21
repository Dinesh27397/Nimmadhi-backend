import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TransactionsController } from './transactions.controller.js';
import { TransactionsService } from './transactions.service.js';
import { SmsImportsService } from './sms-imports.service.js';
import { EmailImportsService } from './email-imports.service.js';
import { EmailOAuthController } from './email-oauth.controller.js';
import { EmailTokenCipher } from './email-token-cipher.js';

@Module({
  imports: [PrismaModule],
  controllers: [TransactionsController, EmailOAuthController],
  providers: [
    TransactionsService,
    SmsImportsService,
    EmailImportsService,
    EmailTokenCipher,
  ],
  exports: [TransactionsService, SmsImportsService, EmailImportsService],
})
export class TransactionsModule {}

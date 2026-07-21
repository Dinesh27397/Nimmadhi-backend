import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SmsService } from './sms.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { OnboardingStrategy } from './strategies/onboarding.strategy.js';

@Module({
  imports: [JwtModule.register({}), PassportModule, PrismaModule, UsersModule],
  controllers: [AuthController],
  providers: [AuthService, SmsService, JwtStrategy, OnboardingStrategy],
})
export class AuthModule {}

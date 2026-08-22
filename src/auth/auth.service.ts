import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { decimalToNumber } from '../common/finance/finance-calculations.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SmsService } from './sms.service.js';
import { FirebaseService } from '../firebase/firebase.service.js';
import { CompleteProfileDto } from './dto/complete-profile.dto.js';

const OTP_EXPIRY_SECONDS = Number(process.env.OTP_EXPIRES_IN_SECONDS ?? 300);
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_OTP_ATTEMPTS = 5;
const OTP_BLOCK_MINUTES = 15;
const BCRYPT_ROUNDS = 10;

class TooManyRequestsException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

type UserRecord = {
  id: string;
  mobile: string;
  fullName: string | null;
  email: string | null;
  preferredLanguage: string;
  monthlyIncome?: Prisma.Decimal | null;
  monthlyEssentialExpenses?: Prisma.Decimal | null;
  employmentType?: string | null;
  existingEmiTotal?: Prisma.Decimal | null;
  hasCreditCardDues?: boolean;
  creditCardDueAmount?: Prisma.Decimal | null;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly smsService: SmsService,
    private readonly firebaseService: FirebaseService,
  ) { }

  async requestOtp(mobile: string) {
    const now = new Date();
    const latestOtp = await this.prisma.otpRequest.findFirst({
      where: { mobile, isVerified: false },
      orderBy: { createdAt: 'desc' },
    });

    if (latestOtp && latestOtp.resendAvailableAt > now) {
      const retryAfter = Math.ceil(
        (latestOtp.resendAvailableAt.getTime() - now.getTime()) / 1000,
      );
      throw new TooManyRequestsException(
        `Please wait ${retryAfter} seconds before requesting another OTP`,
      );
    }

    await this.prisma.otpRequest.updateMany({
      where: { mobile, isVerified: false },
      data: { isVerified: true },
    });

    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_SECONDS * 1000);
    const resendAvailableAt = new Date(
      now.getTime() + RESEND_COOLDOWN_SECONDS * 1000,
    );
    const user = await this.prisma.user.findUnique({ where: { mobile } });

    await this.prisma.otpRequest.create({
      data: {
        mobile,
        otpHash,
        expiresAt,
        resendAvailableAt,
        userId: user?.id,
      },
    });
    await this.audit('OTP_REQUESTED', { mobile });
    await this.smsService.sendOtp(mobile, otp);

    return {
      success: true,
      message: 'OTP sent successfully',
      expiresInSeconds: OTP_EXPIRY_SECONDS,
      resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
      ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
    };
  }

  async verifyOtp(mobile: string, otp: string) {
    const now = new Date();
    const otpRecord = await this.prisma.otpRequest.findFirst({
      where: { mobile, isVerified: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    if (otpRecord.blockedUntil && otpRecord.blockedUntil > now) {
      throw new TooManyRequestsException(
        'OTP verification is temporarily blocked',
      );
    }
    if (otpRecord.expiresAt < now) {
      throw new BadRequestException('OTP expired');
    }

    const isOtpValid = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isOtpValid) {
      const attempts = otpRecord.attempts + 1;
      await this.prisma.otpRequest.update({
        where: { id: otpRecord.id },
        data: {
          attempts,
          blockedUntil:
            attempts >= MAX_OTP_ATTEMPTS
              ? new Date(now.getTime() + OTP_BLOCK_MINUTES * 60 * 1000)
              : null,
        },
      });
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.prisma.otpRequest.update({
      where: { id: otpRecord.id },
      data: { isVerified: true },
    });

    const user = await this.prisma.user.findUnique({ where: { mobile } });
    if (!user) {
      const onboardingToken = await this.signOnboardingToken(mobile);
      await this.audit('OTP_VERIFIED_NEW_USER', { mobile });
      return {
        success: true,
        isNewUser: true,
        nextStep: 'COMPLETE_PROFILE',
        onboardingToken,
      };
    }

    const tokens = await this.issueTokens(user.id, user.mobile);
    await this.audit('OTP_VERIFIED_EXISTING_USER', { userId: user.id, mobile });
    return {
      success: true,
      isNewUser: false,
      nextStep: 'DASHBOARD',
      ...tokens,
      user: this.toSafeUser(user),
    };
  }

  async completeProfile(dto: CompleteProfileDto) {
    const mobile = dto.mobile;
    const existingUser = await this.prisma.user.findUnique({
      where: { mobile },
    });

    const profileData = {
      fullName: dto.fullName,
      email: dto.email,
      preferredLanguage: dto.preferredLanguage ?? 'en',
      monthlyIncome: new Prisma.Decimal(dto.monthlyIncome),
      monthlyEssentialExpenses: new Prisma.Decimal(dto.monthlyExpenses),
      employmentType: dto.employmentType,
      existingEmiTotal: new Prisma.Decimal(dto.existingEmiTotal),
      hasCreditCardDues: dto.hasCreditCardDues,
      creditCardDueAmount:
        dto.creditCardDueAmount === undefined
          ? null
          : new Prisma.Decimal(dto.creditCardDueAmount),
      isVerified: true,
    };

    const user = existingUser
      ? await this.prisma.user.update({
        where: { mobile },
        data: profileData,
      })
      : await this.prisma.user.create({
        data: {
          mobile,
          ...profileData,
        },
      });
    await this.audit('PROFILE_COMPLETED', { userId: user.id, mobile });
    const tokens = await this.issueTokens(user.id, user.mobile);

    return {
      success: true,
      message: 'Profile completed',
      ...tokens,
      user: this.toSafeUser(user),
    };
  }

  async setPin(userId: string, pin: string) {
    const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { pinHash },
    });
    await this.audit('PIN_SET', { userId });

    return {
      success: true,
      message: 'PIN set successfully',
      nextStep: 'DASHBOARD',
    };
  }

  async loginPin(mobile: string, pin: string) {
    // TODO: Add Redis-backed attempt limiting by mobile and IP address.
    const user = await this.prisma.user.findUnique({ where: { mobile } });
    if (!user?.pinHash) {
      throw new UnauthorizedException('Invalid mobile or PIN');
    }

    const isPinValid = await bcrypt.compare(pin, user.pinHash);
    if (!isPinValid) {
      throw new UnauthorizedException('Invalid mobile or PIN');
    }

    const tokens = await this.issueTokens(user.id, user.mobile);
    await this.audit('PIN_LOGIN', { userId: user.id, mobile });

    return {
      success: true,
      ...tokens,
      user: this.toSafeUser(user),
    };
  }

  async refreshToken(refreshToken: string) {
    let payload: { sub: string; mobile: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const storedTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });
    const matchingToken = await this.findMatchingRefreshToken(
      refreshToken,
      storedTokens,
    );
    if (!matchingToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: matchingToken.id },
      data: { revoked: true },
    });
    const tokens = await this.issueTokens(payload.sub, payload.mobile);

    return {
      success: true,
      ...tokens,
    };
  }

  async logout(refreshToken: string) {
    let payload: { sub: string; mobile: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const storedTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });
    const matchingToken = await this.findMatchingRefreshToken(
      refreshToken,
      storedTokens,
    );
    if (!matchingToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: matchingToken.id },
      data: { revoked: true },
    });
    await this.audit('LOGOUT', {
      userId: payload.sub,
      mobile: payload.mobile,
    });

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      success: true,
      user: this.toSafeUser(user),
    };
  }

  private generateOtp() {
    // if (process.env.NODE_ENV !== 'production') {
    //   return '123456';
    // }

    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private async signOnboardingToken(mobile: string) {
    return this.jwtService.signAsync(
      { mobile, purpose: 'onboarding' },
      {
        secret: process.env.JWT_ONBOARDING_SECRET ?? 'dev-onboarding-secret',
        expiresIn: '15m',
      },
    );
  }

  private async issueTokens(userId: string, mobile: string) {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, mobile },
      {
        secret: process.env.JWT_SECRET ?? 'dev-access-secret',
        expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as never,
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, mobile },
      {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as never,
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: await bcrypt.hash(refreshToken, BCRYPT_ROUNDS),
        expiresAt: this.getRefreshExpiryDate(),
      },
    });

    return { accessToken, refreshToken };
  }

  private async findMatchingRefreshToken(
    refreshToken: string,
    storedTokens: { id: string; tokenHash: string }[],
  ) {
    for (const storedToken of storedTokens) {
      if (await bcrypt.compare(refreshToken, storedToken.tokenHash)) {
        return storedToken;
      }
    }

    return null;
  }

  private getRefreshExpiryDate() {
    const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
    const match = /^(\d+)([dhm])$/.exec(expiresIn);
    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = Number(match[1]);
    const unit = match[2];
    const multiplier =
      unit === 'd'
        ? 24 * 60 * 60 * 1000
        : unit === 'h'
          ? 60 * 60 * 1000
          : 60 * 1000;
    return new Date(Date.now() + value * multiplier);
  }


  async verifyFirebaseToken(idToken: string) {
    const verified = await this.firebaseService.verifyIdToken(idToken);
    if (!verified.phoneNumber) {
      throw new BadRequestException(
        'Firebase token does not contain a verified phone number',
      );
    }

    const mobile = verified.phoneNumber.replace(/\D/g, '').slice(-10);
    const existingUser = await this.prisma.user.findUnique({
      where: { mobile },
    });

    if (!existingUser) {
      const onboardingToken = await this.jwtService.signAsync(
        { sub: mobile, mobile, role: 'ONBOARDING' },
        {
          secret:
            process.env.JWT_ONBOARDING_SECRET ??
            'nimmadhi-onboarding-secret-2026',
          expiresIn: '1h',
        },
      );

      return {
        success: true,
        isNewUser: true,
        nextStep: 'COMPLETE_PROFILE',
        onboardingToken,
      };
    }

    const tokens = await this.issueTokens(existingUser.id, existingUser.mobile);
    await this.audit('LOGIN_FIREBASE', { userId: existingUser.id, mobile });

    return {
      success: true,
      isNewUser: false,
      nextStep: 'DASHBOARD',
      ...tokens,
      user: this.toSafeUser(existingUser),
    };
  }

  private toSafeUser(user: UserRecord) {
    return {
      id: user.id,
      mobile: user.mobile,
      fullName: user.fullName,
      email: user.email,
      preferredLanguage: user.preferredLanguage,
      monthlyIncome: decimalToNumber(user.monthlyIncome),
      monthlyEssentialExpenses: decimalToNumber(user.monthlyEssentialExpenses),
      employmentType: user.employmentType,
      existingEmiTotal: decimalToNumber(user.existingEmiTotal),
      hasCreditCardDues: user.hasCreditCardDues,
      creditCardDueAmount: decimalToNumber(user.creditCardDueAmount),
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async audit(
    action: string,
    data: {
      userId?: string;
      mobile?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    await this.prisma.auditLog.create({
      data: {
        action,
        userId: data.userId,
        mobile: data.mobile,
        metadata: data.metadata as never,
      },
    });
  }
}

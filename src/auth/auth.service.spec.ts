import { jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { EmploymentType } from './dto/complete-profile.dto.js';
import { SmsService } from './sms.service.js';
import { FirebaseService } from '../firebase/firebase.service.js';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: {
      findUnique: jest.fn<() => Promise<unknown>>(),
      create: jest.fn<() => Promise<unknown>>(),
      update: jest.fn<() => Promise<unknown>>(),
    },
    refreshToken: {
      findMany: jest.fn<() => Promise<unknown>>(),
      create: jest.fn<() => Promise<unknown>>(),
      update: jest.fn<() => Promise<unknown>>(),
    },
    auditLog: {
      create: jest.fn<() => Promise<unknown>>(),
    },
  };
  const jwtService = {
    signAsync: jest.fn<() => Promise<unknown>>(),
    verifyAsync: jest.fn<() => Promise<unknown>>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: SmsService,
          useValue: {
            sendOtp: jest.fn(),
          },
        },
        {
          provide: FirebaseService,
          useValue: {
            verifyIdToken: jest.fn(),
            sendPushNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('issues an authenticated session after profile completion', async () => {
    const user = {
      id: 'user-1',
      mobile: '8526815030',
      fullName: 'Dinesh Kumar',
      email: null,
      preferredLanguage: 'en',
      monthlyIncome: 90000,
      monthlyEssentialExpenses: 25000,
      employmentType: EmploymentType.Salaried,
      existingEmiTotal: 12000,
      hasCreditCardDues: false,
      creditCardDueAmount: null,
      isVerified: true,
      createdAt: new Date('2026-07-31T00:00:00.000Z'),
      updatedAt: new Date('2026-07-31T00:00:00.000Z'),
    };

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(user);
    prisma.refreshToken.create.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const result = await service.completeProfile({
      mobile: '8526815030',
      fullName: 'Dinesh Kumar',
      preferredLanguage: 'en',
      monthlyIncome: 90000,
      employmentType: EmploymentType.Salaried,
      monthlyExpenses: 25000,
      existingEmiTotal: 12000,
      hasCreditCardDues: false,
    });

    expect(result).toMatchObject({
      success: true,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-1',
        mobile: '8526815030',
      },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('revokes the submitted refresh token on logout', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      mobile: '8526815030',
    });
    prisma.refreshToken.findMany.mockResolvedValue([
      {
        id: 'refresh-token-1',
        tokenHash: await bcrypt.hash('refresh-token', 10),
      },
    ]);
    prisma.refreshToken.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});

    const result = await service.logout('refresh-token');

    expect(result).toEqual({
      success: true,
      message: 'Logged out successfully',
    });
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'refresh-token-1' },
      data: { revoked: true },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'LOGOUT',
        userId: 'user-1',
        mobile: '8526815030',
        metadata: undefined,
      },
    });
  });
});

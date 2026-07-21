import { jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { SmsService } from './sms.service.js';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    refreshToken: {
      findMany: jest.fn<() => Promise<unknown>>(),
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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

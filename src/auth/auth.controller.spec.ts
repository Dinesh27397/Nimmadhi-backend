import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import {
  CompleteProfileDto,
  EmploymentType,
} from './dto/complete-profile.dto.js';

describe('AuthController', () => {
  let controller: AuthController;
  const completeProfile = jest.fn();

  beforeEach(async () => {
    completeProfile.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            requestOtp: jest.fn(),
            verifyOtp: jest.fn(),
            completeProfile,
            setPin: jest.fn(),
            loginPin: jest.fn(),
            refreshToken: jest.fn(),
            logout: jest.fn(),
            me: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('uses the verified onboarding mobile when completing a profile', () => {
    const dto: CompleteProfileDto = {
      mobile: '9876543210',
      fullName: 'Dinesh Kumar',
      preferredLanguage: 'en',
      monthlyIncome: 90000,
      employmentType: EmploymentType.Salaried,
      monthlyExpenses: 25000,
      existingEmiTotal: 12000,
      hasCreditCardDues: false,
    };

    controller.completeProfile(dto, { mobile: '8526815030' });

    expect(completeProfile).toHaveBeenCalledWith({
      ...dto,
      mobile: '8526815030',
    });
  });
});

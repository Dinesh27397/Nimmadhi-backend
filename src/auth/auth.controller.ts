import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { AuthService } from './auth.service.js';
import { CompleteProfileDto } from './dto/complete-profile.dto.js';
import { LoginPinDto } from './dto/login-pin.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { SetPinDto } from './dto/set-pin.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-otp')
  @ApiOperation({ summary: 'Request a mobile OTP' })
  @ApiBody({ type: RequestOtpDto })
  @ApiOkResponse({
    description:
      'OTP generated and sent. Development responses include devOtp.',
    schema: {
      example: {
        success: true,
        message: 'OTP sent successfully',
        expiresInSeconds: 300,
        resendAfterSeconds: 30,
        devOtp: '123456',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid Indian mobile number' })
  @ApiTooManyRequestsResponse({ description: 'OTP resend cooldown is active' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.mobile);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP and continue login or onboarding' })
  @ApiBody({ type: VerifyOtpDto })
  @ApiOkResponse({
    description: 'Returns either dashboard tokens or onboarding token.',
    schema: {
      oneOf: [
        {
          example: {
            success: true,
            isNewUser: false,
            nextStep: 'DASHBOARD',
            accessToken: 'ey...',
            refreshToken: 'ey...',
            user: {
              id: 'uuid',
              mobile: '9876543210',
              fullName: 'Dinesh Kumar',
              email: 'dinesh@example.com',
              preferredLanguage: 'en',
              isVerified: true,
            },
          },
        },
        {
          example: {
            success: true,
            isNewUser: true,
            nextStep: 'COMPLETE_PROFILE',
            onboardingToken: 'ey...',
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({ description: 'OTP is missing or expired' })
  @ApiUnauthorizedResponse({ description: 'Invalid OTP' })
  @ApiTooManyRequestsResponse({ description: 'Too many invalid OTP attempts' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.mobile, dto.otp);
  }

  @Post('complete-profile')
  @ApiOperation({ summary: 'Complete onboarding profile' })
  @ApiBody({ type: CompleteProfileDto })
  @ApiOkResponse({
    description: 'Profile created or updated.',
    schema: {
      example: {
        success: true,
        message: 'Profile completed',
        user: {
          id: 'uuid',
          mobile: '9876543210',
          fullName: 'Dinesh Kumar',
          email: 'dinesh@example.com',
          preferredLanguage: 'en',
          monthlyIncome: '90000',
          isVerified: true,
        },
      },
    },
  })
  completeProfile(@Body() dto: CompleteProfileDto) {
    return this.authService.completeProfile(dto);
  }

  @Post('set-pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Set a 4 digit login PIN' })
  @ApiBody({ type: SetPinDto })
  @ApiOkResponse({
    description: 'PIN hash stored successfully.',
    schema: {
      example: {
        success: true,
        message: 'PIN set successfully',
        nextStep: 'DASHBOARD',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  setPin(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetPinDto) {
    return this.authService.setPin(user.sub, dto.pin);
  }

  @Post('login-pin')
  @ApiOperation({ summary: 'Login with mobile number and PIN' })
  @ApiBody({ type: LoginPinDto })
  @ApiOkResponse({
    description: 'PIN login successful.',
    schema: {
      example: {
        success: true,
        accessToken: 'ey...',
        refreshToken: 'ey...',
        user: {
          id: 'uuid',
          mobile: '9876543210',
          fullName: 'Dinesh Kumar',
          email: 'dinesh@example.com',
          preferredLanguage: 'en',
          isVerified: true,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid mobile or PIN' })
  loginPin(@Body() dto: LoginPinDto) {
    return this.authService.loginPin(dto.mobile, dto.pin);
  }

  @Post('refresh-token')
  @ApiOperation({
    summary: 'Rotate refresh token and issue a new access token',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({
    description: 'Refresh token accepted and rotated.',
    schema: {
      example: {
        success: true,
        accessToken: 'ey...',
        refreshToken: 'ey...',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke the submitted refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({
    description: 'Refresh token revoked successfully.',
    schema: {
      example: {
        success: true,
        message: 'Logged out successfully',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Return logged in user profile' })
  @ApiOkResponse({
    description: 'Logged in user profile.',
    schema: {
      example: {
        success: true,
        user: {
          id: 'uuid',
          mobile: '9876543210',
          fullName: 'Dinesh Kumar',
          email: 'dinesh@example.com',
          preferredLanguage: 'en',
          isVerified: true,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.sub);
  }
}

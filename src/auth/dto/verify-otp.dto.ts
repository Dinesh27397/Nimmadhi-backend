import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    example: '9876543210',
    description: 'Indian 10-digit mobile number starting with 6, 7, 8, or 9',
  })
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Enter a valid 10-digit Indian mobile number',
  })
  mobile: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP' })
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  otp: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Matches } from 'class-validator';

export class LoginPinDto {
  @ApiProperty({
    example: '9876543210',
    description: 'Indian 10-digit mobile number starting with 6, 7, 8, or 9',
  })
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Enter a valid 10-digit Indian mobile number',
  })
  mobile: string;

  @ApiProperty({ example: '1234', description: 'Exactly 4 numeric digits' })
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 numeric digits' })
  pin: string;
}

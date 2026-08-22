import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FirebaseVerifyDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
    description: 'Firebase Phone Auth ID Token obtained after SMS OTP verification',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

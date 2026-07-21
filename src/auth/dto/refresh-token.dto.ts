import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'JWT refresh token returned by login or refresh',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

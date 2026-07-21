import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EmailProvider } from '../../../generated/prisma/client.js';

export class EmailProviderDto {
  @ApiProperty({ enum: EmailProvider })
  @IsEnum(EmailProvider)
  provider: EmailProvider;
}

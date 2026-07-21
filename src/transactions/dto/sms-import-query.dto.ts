import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SmsImportReviewStatus } from '../../../generated/prisma/client.js';

export class SmsImportQueryDto {
  @ApiPropertyOptional({ enum: SmsImportReviewStatus })
  @IsOptional()
  @IsEnum(SmsImportReviewStatus)
  status?: SmsImportReviewStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

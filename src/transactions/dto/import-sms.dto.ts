import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SmsMessageDto {
  @ApiProperty({ example: '18242' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  id: string;

  @ApiProperty({ example: 'VK-HDFCBK' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sender: string;

  @ApiProperty({
    example: 'Rs.1,250 debited from A/c XX4567 at Indian Oil. Ref UTR123456.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body: string;

  @ApiProperty({ example: '2026-07-21T08:30:00.000Z' })
  @IsISO8601({ strict: true })
  occurredAt: string;
}

export class ImportSmsDto {
  @ApiProperty({ type: [SmsMessageDto], maxItems: 200 })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SmsMessageDto)
  messages: SmsMessageDto[];
}

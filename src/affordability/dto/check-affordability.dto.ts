import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsString, Min } from 'class-validator';

export class CheckAffordabilityDto {
  @ApiProperty({ example: 'iPhone' })
  @IsString()
  itemName: string;

  @ApiProperty({ example: 80000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 20000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  downPayment: number;

  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyEmi: number;

  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tenureMonths: number;
}

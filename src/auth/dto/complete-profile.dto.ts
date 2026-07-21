import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export enum EmploymentType {
  Salaried = 'SALARIED',
  SelfEmployed = 'SELF_EMPLOYED',
  Business = 'BUSINESS',
  Student = 'STUDENT',
  Homemaker = 'HOMEMAKER',
  Retired = 'RETIRED',
  Other = 'OTHER',
}

export class CompleteProfileDto {
  @ApiProperty({
    example: '9876543210',
    description: 'Indian 10-digit mobile number starting with 6, 7, 8, or 9',
  })
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Enter a valid 10-digit Indian mobile number',
  })
  mobile: string;

  @ApiProperty({ example: 'Dinesh Kumar', description: 'Customer full name' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional({
    example: 'dinesh@example.com',
    description: 'Optional unique email address',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: 'en',
    enum: ['en', 'ta', 'hi'],
    description: 'Preferred app language',
  })
  @IsOptional()
  @IsIn(['en', 'ta', 'hi'])
  preferredLanguage: 'en' | 'ta' | 'hi';

  @ApiProperty({ example: 90000, description: 'Monthly income' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyIncome: number;

  @ApiProperty({
    example: EmploymentType.Salaried,
    enum: EmploymentType,
    description: 'Customer employment type',
  })
  @IsIn(Object.values(EmploymentType))
  employmentType: EmploymentType;

  @ApiProperty({ example: 25000, description: 'Monthly expenses' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyExpenses: number;

  @ApiProperty({ example: 12000, description: 'Total monthly EMI amount' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  existingEmiTotal: number;

  @ApiProperty({
    example: false,
    description: 'Whether the customer has credit card dues',
  })
  @IsBoolean()
  hasCreditCardDues: boolean;

  @ApiPropertyOptional({
    example: 5000,
    description: 'Outstanding credit card due amount',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditCardDueAmount?: number;
}

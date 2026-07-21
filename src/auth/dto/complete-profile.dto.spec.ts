import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { CompleteProfileDto } from './complete-profile.dto.js';

describe('CompleteProfileDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: CompleteProfileDto,
  };

  it('accepts the two-step profile payload from the mobile app', async () => {
    const result: unknown = await pipe.transform(
      {
        mobile: '8526815030',
        fullName: 'Dinesh',
        monthlyIncome: 60000,
        employmentType: 'SALARIED',
        monthlyExpenses: 960000,
        existingEmiTotal: 0,
        hasCreditCardDues: false,
      },
      metadata,
    );

    expect(result).toBeInstanceOf(CompleteProfileDto);
    expect(result).toMatchObject({
      mobile: '8526815030',
      fullName: 'Dinesh',
      monthlyIncome: 60000,
      employmentType: 'SALARIED',
      monthlyExpenses: 960000,
      existingEmiTotal: 0,
      hasCreditCardDues: false,
    });
  });
});

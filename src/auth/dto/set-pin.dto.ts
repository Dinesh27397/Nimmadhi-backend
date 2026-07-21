import { ApiProperty } from '@nestjs/swagger';
import { Matches, Validate } from 'class-validator';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'pinsMatch', async: false })
class PinsMatchConstraint implements ValidatorConstraintInterface {
  validate(confirmPin: string, args: ValidationArguments) {
    const body = args.object as SetPinDto;
    return confirmPin === body.pin;
  }

  defaultMessage() {
    return 'confirmPin must match pin';
  }
}

export class SetPinDto {
  @ApiProperty({ example: '1234', description: 'Exactly 4 numeric digits' })
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 numeric digits' })
  pin: string;

  @ApiProperty({ example: '1234', description: 'Must match pin' })
  @Matches(/^\d{4}$/, {
    message: 'Confirm PIN must be exactly 4 numeric digits',
  })
  @Validate(PinsMatchConstraint)
  confirmPin: string;
}

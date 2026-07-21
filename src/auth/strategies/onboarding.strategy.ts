import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export type OnboardingPayload = {
  mobile: string;
  purpose: 'onboarding';
};

@Injectable()
export class OnboardingStrategy extends PassportStrategy(
  Strategy,
  'jwt-onboarding',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ONBOARDING_SECRET ?? 'dev-onboarding-secret',
    });
  }

  validate(payload: OnboardingPayload) {
    return payload;
  }
}

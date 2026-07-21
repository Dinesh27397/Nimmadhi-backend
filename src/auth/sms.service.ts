import { Injectable } from '@nestjs/common';

@Injectable()
export class SmsService {
  async sendOtp(mobile: string, otp: string) {
    await Promise.resolve();
    // This keeps SMS delivery behind one injectable service, so a real provider
    // can replace this stub without changing AuthService.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV OTP] +91${mobile}: ${otp}`);
    }
  }
}

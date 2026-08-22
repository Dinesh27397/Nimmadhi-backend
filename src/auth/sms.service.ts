import { Injectable, Logger } from '@nestjs/common';

export interface SmsProviderResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  /**
   * Dispatches the 6-digit OTP to the recipient's mobile number.
   * Dynamically selects provider based on configured environment variables:
   * 1. Fast2SMS (India DLT / Quick SMS)
   * 2. Twilio (Global SMS Gateway)
   * 3. MSG91 (India DLT OTP)
   * 4. Dev / Console fallback
   */
  async sendOtp(mobile: string, otp: string): Promise<SmsProviderResult> {
    const rawMobile = mobile.replace(/\D/g, '');
    const localMobile = rawMobile.slice(-10);

    const provider = process.env.SMS_PROVIDER || this.detectProvider();

    switch (provider) {
      case 'fast2sms':
        return this.sendViaFast2Sms(localMobile, otp);
      case 'twilio':
        return this.sendViaTwilio(localMobile, otp);
      case 'msg91':
        return this.sendViaMsg91(localMobile, otp);
      case 'dev':
      default:
        return this.sendViaDev(localMobile, otp);
    }
  }

  private detectProvider(): string {
    if (process.env.FAST2SMS_API_KEY) return 'fast2sms';
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return 'twilio';
    if (process.env.MSG91_AUTH_KEY) return 'msg91';
    return 'dev';
  }

  private async sendViaFast2Sms(mobile: string, otp: string): Promise<SmsProviderResult> {
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) {
      this.logger.warn('FAST2SMS_API_KEY missing, falling back to dev SMS');
      return this.sendViaDev(mobile, otp);
    }
    try {
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'otp',
          variables_values: otp,
          numbers: mobile,
        }),
      });

      const data = (await response.json()) as { return?: boolean; message?: string[]; request_id?: string };
      if (response.ok && data.return) {
        this.logger.log(`[Fast2SMS] OTP dispatched to +91 ${mobile.slice(0, 3)}***${mobile.slice(-2)}`);
        return { success: true, provider: 'fast2sms', messageId: data.request_id };
      }

      this.logger.error(`[Fast2SMS] Delivery failed: ${JSON.stringify(data.message)}`);
      return { success: false, provider: 'fast2sms', error: Array.isArray(data.message) ? data.message.join(', ') : 'Delivery failed' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Fast2SMS] Network error: ${message}`);
      return { success: false, provider: 'fast2sms', error: message };
    }
  }

  private async sendViaTwilio(mobile: string, otp: string): Promise<SmsProviderResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid || !authToken || !fromPhone) {
      this.logger.warn('Twilio credentials missing, falling back to dev SMS');
      return this.sendViaDev(mobile, otp);
    }
    try {
      const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const body = new URLSearchParams({
        To: `+91${mobile}`,
        From: fromPhone,
        Body: `Your Nimmadhi verification code is ${otp}. Valid for 5 minutes. Do not share this OTP.`,
      });

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        },
      );

      const data = (await response.json()) as { sid?: string; message?: string; status?: string };
      if (response.ok && data.sid) {
        this.logger.log(`[Twilio] OTP dispatched to +91 ${mobile.slice(0, 3)}***${mobile.slice(-2)}`);
        return { success: true, provider: 'twilio', messageId: data.sid };
      }

      this.logger.error(`[Twilio] Delivery error: ${data.message || data.status}`);
      return { success: false, provider: 'twilio', error: data.message || 'Delivery error' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Twilio] Network error: ${message}`);
      return { success: false, provider: 'twilio', error: message };
    }
  }

  private async sendViaMsg91(mobile: string, otp: string): Promise<SmsProviderResult> {
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;
    if (!authKey) {
      this.logger.warn('MSG91_AUTH_KEY missing, falling back to dev SMS');
      return this.sendViaDev(mobile, otp);
    }
    try {
      const response = await fetch('https://control.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: {
          authkey: authKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: templateId,
          mobile: `91${mobile}`,
          otp,
        }),
      });

      const data = (await response.json()) as { type?: string; message?: string };
      if (response.ok && data.type === 'success') {
        this.logger.log(`[MSG91] OTP dispatched to +91 ${mobile.slice(0, 3)}***${mobile.slice(-2)}`);
        return { success: true, provider: 'msg91', messageId: data.message };
      }

      this.logger.error(`[MSG91] Delivery failed: ${data.message}`);
      return { success: false, provider: 'msg91', error: data.message || 'Delivery failed' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[MSG91] Network error: ${message}`);
      return { success: false, provider: 'msg91', error: message };
    }
  }

  private sendViaDev(mobile: string, otp: string): SmsProviderResult {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV OTP] +91${mobile}: ${otp}`);
    }
    return { success: true, provider: 'dev' };
  }
}

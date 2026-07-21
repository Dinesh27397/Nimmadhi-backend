import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

@Injectable()
export class EmailTokenCipher {
  encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [iv, tag, encrypted]
      .map((part) => part.toString('base64url'))
      .join('.');
  }

  decrypt(value: string) {
    try {
      const [iv, tag, encrypted] = value
        .split('.')
        .map((part) => Buffer.from(part, 'base64url'));
      const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException(
        'Stored email authorization could not be decrypted',
      );
    }
  }

  private key() {
    const configured = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
    if (process.env.NODE_ENV === 'production' && !configured) {
      throw new ServiceUnavailableException(
        'EMAIL_TOKEN_ENCRYPTION_KEY is required in production',
      );
    }
    return createHash('sha256')
      .update(configured ?? process.env.JWT_SECRET ?? 'dev-email-token-key')
      .digest();
  }
}

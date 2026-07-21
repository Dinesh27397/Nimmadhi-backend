import { EmailTokenCipher } from './email-token-cipher.js';

describe('EmailTokenCipher', () => {
  it('encrypts and authenticates stored OAuth tokens', () => {
    const cipher = new EmailTokenCipher();
    const encrypted = cipher.encrypt('refresh-token-value');

    expect(encrypted).not.toContain('refresh-token-value');
    expect(cipher.decrypt(encrypted)).toBe('refresh-token-value');
  });

  it('rejects tampered encrypted tokens', () => {
    const cipher = new EmailTokenCipher();
    const encrypted = cipher.encrypt('refresh-token-value');

    expect(() => cipher.decrypt(`${encrypted}x`)).toThrow(
      'Stored email authorization could not be decrypted',
    );
  });
});

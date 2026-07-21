import { jest } from '@jest/globals';
import {
  EmailConnectionStatus,
  EmailProvider,
} from '../../generated/prisma/client.js';
import { EmailImportsService } from './email-imports.service.js';

const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
const connection = {
  id: 'connection-1',
  userId: 'user-1',
  provider: EmailProvider.GMAIL,
  status: EmailConnectionStatus.PENDING,
  emailAddress: null,
  accessTokenEncrypted: null,
  refreshTokenEncrypted: null,
  accessTokenExpiresAt: null,
  grantedScopes: null,
  stateNonce: '',
  stateExpiresAt: expiresAt,
  lastSyncAt: null,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('EmailImportsService', () => {
  const prisma = {
    emailConnection: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const cipher = {
    encrypt: jest.fn((value: string) => `encrypted:${value}`),
    decrypt: jest.fn((value: string) => value.replace('encrypted:', '')),
  };
  const smsImports = { importMessages: jest.fn() };
  const service = new EmailImportsService(
    prisma as never,
    cipher as never,
    smsImports as never,
  );
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GMAIL_CLIENT_ID = 'gmail-client';
    process.env.GMAIL_CLIENT_SECRET = 'gmail-secret';
    process.env.EMAIL_OAUTH_CALLBACK_URL =
      'https://api.example.com/transactions/email/oauth/callback';
    process.env.EMAIL_OAUTH_STATE_SECRET = 'state-secret';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('creates a signed Gmail authorization URL with read-only access', async () => {
    prisma.emailConnection.upsert.mockImplementation(({ create }) => ({
      ...connection,
      // Jest's untyped mock arguments are dynamic by design.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      stateNonce: create.stateNonce,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      stateExpiresAt: create.stateExpiresAt,
    }));

    const result = await service.connect('user-1', EmailProvider.GMAIL);
    const url = new URL(result.authorizationUrl);

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('scope')).toBe(
      'https://www.googleapis.com/auth/gmail.readonly',
    );
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('exchanges the callback code and stores only encrypted tokens', async () => {
    prisma.emailConnection.upsert.mockImplementation(({ create }) => ({
      ...connection,
      // Jest's untyped mock arguments are dynamic by design.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      stateNonce: create.stateNonce,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      stateExpiresAt: create.stateExpiresAt,
    }));
    const authorization = await service.connect('user-1', EmailProvider.GMAIL);
    const state = new URL(authorization.authorizationUrl).searchParams.get(
      'state',
    )!;
    const pending = prisma.emailConnection.upsert.mock.results[0].value;
    prisma.emailConnection.findUnique.mockResolvedValue(pending);
    prisma.emailConnection.update.mockImplementation(({ data }) => ({
      ...pending,
      ...data,
    }));
    global.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 3600,
            scope: 'https://www.googleapis.com/auth/gmail.readonly',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ emailAddress: 'user@example.com' }), {
          status: 200,
        }),
      );

    const result = await service.completeOAuth('oauth-code', state);

    expect(result).toMatchObject({
      provider: EmailProvider.GMAIL,
      status: EmailConnectionStatus.CONNECTED,
      emailAddress: 'user@example.com',
    });
    expect(prisma.emailConnection.update).toHaveBeenCalledWith({
      where: { id: 'connection-1' },
      // Jest asymmetric matchers are intentionally dynamic test values.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        accessTokenEncrypted: 'encrypted:access-token',
        refreshTokenEncrypted: 'encrypted:refresh-token',
      }),
    });
  });
});

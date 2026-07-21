import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  EmailConnectionStatus,
  EmailProvider,
  TransactionSource,
} from '../../generated/prisma/client.js';
import type { EmailConnection } from '../../generated/prisma/client.js';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SmsMessageDto } from './dto/import-sms.dto.js';
import { EmailTokenCipher } from './email-token-cipher.js';
import { SmsImportsService } from './sms-imports.service.js';

type OAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

type ProviderConfig = {
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  scopes: string;
};

type GmailPayload = {
  mimeType?: string;
  body?: { data?: string };
  headers?: Array<{ name: string; value: string }>;
  parts?: GmailPayload[];
};

@Injectable()
export class EmailImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: EmailTokenCipher,
    private readonly smsImports: SmsImportsService,
  ) {}

  async connect(userId: string, provider: EmailProvider) {
    const config = this.providerConfig(provider);
    const nonce = randomBytes(24).toString('base64url');
    const stateExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const connection = await this.prisma.emailConnection.upsert({
      where: { userId_provider: { userId, provider } },
      create: {
        userId,
        provider,
        stateNonce: nonce,
        stateExpiresAt,
        status: EmailConnectionStatus.PENDING,
      },
      update: {
        stateNonce: nonce,
        stateExpiresAt,
        status: EmailConnectionStatus.PENDING,
        lastError: null,
      },
    });
    const state = this.signState({
      connectionId: connection.id,
      nonce,
      expiresAt: stateExpiresAt.getTime(),
    });
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: this.callbackUrl(),
      scope: config.scopes,
      state,
    });

    if (provider === EmailProvider.GMAIL) {
      params.set('access_type', 'offline');
      params.set('prompt', 'consent');
      params.set('include_granted_scopes', 'true');
    } else {
      params.set('response_mode', 'query');
    }

    return {
      provider,
      authorizationUrl: `${config.authorizationEndpoint}?${params.toString()}`,
      expiresAt: stateExpiresAt.toISOString(),
    };
  }

  async completeOAuth(code: string, state: string) {
    const stateData = this.verifyState(state);
    const connection = await this.prisma.emailConnection.findUnique({
      where: { id: stateData.connectionId },
    });
    if (
      !connection ||
      connection.stateNonce !== stateData.nonce ||
      !connection.stateExpiresAt ||
      connection.stateExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Email authorization state is invalid');
    }

    const config = this.providerConfig(connection.provider);
    try {
      const tokens = await this.exchangeCode(config, code);
      const profile = await this.fetchProfile(
        connection.provider,
        tokens.access_token,
      );
      const updated = await this.prisma.emailConnection.update({
        where: { id: connection.id },
        data: {
          status: EmailConnectionStatus.CONNECTED,
          emailAddress: profile.emailAddress,
          accessTokenEncrypted: this.cipher.encrypt(tokens.access_token),
          refreshTokenEncrypted: tokens.refresh_token
            ? this.cipher.encrypt(tokens.refresh_token)
            : connection.refreshTokenEncrypted,
          accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          grantedScopes: tokens.scope ?? config.scopes,
          stateNonce: null,
          stateExpiresAt: null,
          lastError: null,
        },
      });
      return this.toStatus(updated);
    } catch (error) {
      await this.prisma.emailConnection.update({
        where: { id: connection.id },
        data: {
          status: EmailConnectionStatus.ERROR,
          lastError: this.errorMessage(error),
          stateNonce: null,
          stateExpiresAt: null,
        },
      });
      throw error;
    }
  }

  async status(userId: string) {
    const connections = await this.prisma.emailConnection.findMany({
      where: { userId },
      orderBy: { provider: 'asc' },
    });
    return {
      providers: [EmailProvider.GMAIL, EmailProvider.OUTLOOK].map(
        (provider) => {
          const connection = connections.find(
            (item) => item.provider === provider,
          );
          return connection
            ? this.toStatus(connection)
            : {
                provider,
                status: 'DISCONNECTED' as const,
                emailAddress: undefined,
                lastSyncAt: undefined,
                lastError: undefined,
              };
        },
      ),
    };
  }

  async sync(userId: string, provider: EmailProvider) {
    const connection = await this.prisma.emailConnection.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!connection || connection.status !== EmailConnectionStatus.CONNECTED) {
      throw new NotFoundException('Email provider is not connected');
    }

    try {
      const accessToken = await this.getAccessToken(connection);
      const messages =
        provider === EmailProvider.GMAIL
          ? await this.fetchGmailMessages(accessToken, connection.lastSyncAt)
          : await this.fetchOutlookMessages(accessToken, connection.lastSyncAt);
      const result = await this.smsImports.importMessages(
        userId,
        { messages },
        TransactionSource.EMAIL,
      );
      const syncedAt = new Date();
      await this.prisma.emailConnection.update({
        where: { id: connection.id },
        data: { lastSyncAt: syncedAt, lastError: null },
      });
      return {
        provider,
        emailAddress: connection.emailAddress,
        syncedAt: syncedAt.toISOString(),
        ...result,
      };
    } catch (error) {
      await this.prisma.emailConnection.update({
        where: { id: connection.id },
        data: { lastError: this.errorMessage(error) },
      });
      throw error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException
        ? error
        : new BadGatewayException('Email synchronization failed');
    }
  }

  async disconnect(userId: string, provider: EmailProvider) {
    const connection = await this.prisma.emailConnection.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!connection) {
      return { success: true };
    }

    if (provider === EmailProvider.GMAIL && connection.refreshTokenEncrypted) {
      const token = this.cipher.decrypt(connection.refreshTokenEncrypted);
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
        { method: 'POST' },
      ).catch(() => undefined);
    }
    await this.prisma.emailConnection.delete({ where: { id: connection.id } });
    return { success: true };
  }

  private async exchangeCode(config: ProviderConfig, code: string) {
    return this.postToken(config.tokenEndpoint, {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: this.callbackUrl(),
      grant_type: 'authorization_code',
      scope: config.scopes,
    });
  }

  private async getAccessToken(connection: EmailConnection) {
    if (
      connection.accessTokenEncrypted &&
      connection.accessTokenExpiresAt &&
      connection.accessTokenExpiresAt.getTime() > Date.now() + 60_000
    ) {
      return this.cipher.decrypt(connection.accessTokenEncrypted);
    }
    if (!connection.refreshTokenEncrypted) {
      throw new ServiceUnavailableException(
        'Email authorization has expired. Connect the account again.',
      );
    }

    const config = this.providerConfig(connection.provider);
    const tokens = await this.postToken(config.tokenEndpoint, {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: this.cipher.decrypt(connection.refreshTokenEncrypted),
      grant_type: 'refresh_token',
      scope: config.scopes,
    });
    await this.prisma.emailConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEncrypted: this.cipher.encrypt(tokens.access_token),
        refreshTokenEncrypted: tokens.refresh_token
          ? this.cipher.encrypt(tokens.refresh_token)
          : connection.refreshTokenEncrypted,
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        grantedScopes: tokens.scope ?? connection.grantedScopes,
      },
    });
    return tokens.access_token;
  }

  private async postToken(endpoint: string, values: Record<string, string>) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(values),
    });
    if (!response.ok) {
      throw new BadGatewayException('Email provider rejected authorization');
    }
    return (await response.json()) as OAuthTokenResponse;
  }

  private async fetchProfile(provider: EmailProvider, accessToken: string) {
    if (provider === EmailProvider.GMAIL) {
      return this.fetchJson<{ emailAddress: string }>(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        accessToken,
      );
    }
    const profile = await this.fetchJson<{
      mail?: string;
      userPrincipalName: string;
    }>(
      'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName',
      accessToken,
    );
    return { emailAddress: profile.mail ?? profile.userPrincipalName };
  }

  private async fetchGmailMessages(
    accessToken: string,
    lastSyncAt: Date | null,
  ): Promise<SmsMessageDto[]> {
    const after = Math.floor(
      (lastSyncAt?.getTime() ?? Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000,
    );
    const query = new URLSearchParams({
      maxResults: '50',
      q: `after:${after} (debited OR credited OR payment OR transaction OR refund OR cashback OR EMI)`,
    });
    const list = await this.fetchJson<{
      messages?: Array<{ id: string }>;
    }>(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${query.toString()}`,
      accessToken,
    );
    const messages = await Promise.all(
      (list.messages ?? []).map((message) =>
        this.fetchJson<{
          id: string;
          internalDate: string;
          payload: GmailPayload;
        }>(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
          accessToken,
        ),
      ),
    );

    return messages.map((message) => {
      const subject = this.gmailHeader(message.payload, 'Subject');
      const sender = this.gmailHeader(message.payload, 'From') || 'Gmail';
      const body = this.gmailBody(message.payload);
      return {
        id: `gmail:${message.id}`,
        sender: sender.slice(0, 80),
        body: `${subject}. ${body}`.slice(0, 5000),
        occurredAt: new Date(Number(message.internalDate)).toISOString(),
      };
    });
  }

  private async fetchOutlookMessages(
    accessToken: string,
    lastSyncAt: Date | null,
  ): Promise<SmsMessageDto[]> {
    const query = new URLSearchParams({
      $top: '50',
      $select: 'id,subject,from,receivedDateTime,bodyPreview',
      $orderby: 'receivedDateTime desc',
    });
    const response = await this.fetchJson<{
      value: Array<{
        id: string;
        subject?: string;
        from?: { emailAddress?: { address?: string; name?: string } };
        receivedDateTime: string;
        bodyPreview?: string;
      }>;
    }>(
      `https://graph.microsoft.com/v1.0/me/messages?${query.toString()}`,
      accessToken,
    );
    const since =
      lastSyncAt?.getTime() ?? Date.now() - 90 * 24 * 60 * 60 * 1000;

    return response.value
      .filter((message) => new Date(message.receivedDateTime).getTime() > since)
      .map((message) => ({
        id: `outlook:${message.id}`.slice(0, 100),
        sender:
          message.from?.emailAddress?.address ??
          message.from?.emailAddress?.name ??
          'Outlook',
        body: `${message.subject ?? ''}. ${message.bodyPreview ?? ''}`.slice(
          0,
          5000,
        ),
        occurredAt: new Date(message.receivedDateTime).toISOString(),
      }));
  }

  private async fetchJson<T>(url: string, accessToken: string): Promise<T> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new BadGatewayException('Email provider request failed');
    }
    return (await response.json()) as T;
  }

  private gmailHeader(payload: GmailPayload, name: string) {
    return (
      payload.headers?.find(
        (header) => header.name.toLowerCase() === name.toLowerCase(),
      )?.value ?? ''
    );
  }

  private gmailBody(payload: GmailPayload): string {
    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return this.decodeBase64Url(payload.body.data);
    }
    for (const part of payload.parts ?? []) {
      const body = this.gmailBody(part);
      if (body) return body;
    }
    if (payload.body?.data) {
      return this.stripHtml(this.decodeBase64Url(payload.body.data));
    }
    return '';
  }

  private decodeBase64Url(value: string) {
    return Buffer.from(value, 'base64url').toString('utf8');
  }

  private stripHtml(value: string) {
    return value
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private providerConfig(provider: EmailProvider): ProviderConfig {
    const gmail = provider === EmailProvider.GMAIL;
    const clientId =
      process.env[gmail ? 'GMAIL_CLIENT_ID' : 'OUTLOOK_CLIENT_ID'];
    const clientSecret =
      process.env[gmail ? 'GMAIL_CLIENT_SECRET' : 'OUTLOOK_CLIENT_SECRET'];
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        `${provider} OAuth credentials are not configured`,
      );
    }
    return gmail
      ? {
          clientId,
          clientSecret,
          authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenEndpoint: 'https://oauth2.googleapis.com/token',
          scopes: 'https://www.googleapis.com/auth/gmail.readonly',
        }
      : {
          clientId,
          clientSecret,
          authorizationEndpoint:
            'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
          tokenEndpoint:
            'https://login.microsoftonline.com/common/oauth2/v2.0/token',
          scopes: 'offline_access User.Read Mail.Read',
        };
  }

  private callbackUrl() {
    return (
      process.env.EMAIL_OAUTH_CALLBACK_URL ??
      'http://localhost:3000/transactions/email/oauth/callback'
    );
  }

  private signState(payload: {
    connectionId: string;
    nonce: string;
    expiresAt: number;
  }) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${this.stateSignature(encoded)}`;
  }

  private verifyState(state: string) {
    const [encoded, signature] = state.split('.');
    if (!encoded || !signature) {
      throw new BadRequestException('Email authorization state is invalid');
    }
    const expected = Buffer.from(this.stateSignature(encoded), 'base64url');
    const received = Buffer.from(signature, 'base64url');
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new BadRequestException('Email authorization state is invalid');
    }
    try {
      const payload = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8'),
      ) as { connectionId: string; nonce: string; expiresAt: number };
      if (payload.expiresAt < Date.now()) {
        throw new Error('expired');
      }
      return payload;
    } catch {
      throw new BadRequestException('Email authorization state is invalid');
    }
  }

  private stateSignature(encoded: string) {
    return createHmac(
      'sha256',
      process.env.EMAIL_OAUTH_STATE_SECRET ??
        process.env.JWT_SECRET ??
        'dev-email-oauth-state',
    )
      .update(encoded)
      .digest('base64url');
  }

  private toStatus(connection: EmailConnection) {
    return {
      provider: connection.provider,
      status: connection.status,
      emailAddress: connection.emailAddress ?? undefined,
      lastSyncAt: connection.lastSyncAt?.toISOString(),
      lastError: connection.lastError ?? undefined,
    };
  }

  private errorMessage(error: unknown) {
    return error instanceof Error
      ? error.message.slice(0, 500)
      : 'Unknown error';
  }
}

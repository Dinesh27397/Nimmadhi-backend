import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { EmailImportsService } from './email-imports.service.js';

@Controller('transactions/email/oauth')
export class EmailOAuthController {
  constructor(private readonly emailImportsService: EmailImportsService) {}

  @Get('callback')
  @ApiExcludeEndpoint()
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') providerError: string | undefined,
    @Res() response: Response,
  ) {
    const mobileRedirect =
      process.env.NIMMADHI_MOBILE_OAUTH_REDIRECT ??
      'nimmadhi://email-connected';
    if (providerError || !code || !state) {
      return response.redirect(
        `${mobileRedirect}?success=false&error=${encodeURIComponent(
          providerError ?? 'authorization_cancelled',
        )}`,
      );
    }

    try {
      const connection = await this.emailImportsService.completeOAuth(
        code,
        state,
      );
      return response.redirect(
        `${mobileRedirect}?success=true&provider=${connection.provider}`,
      );
    } catch {
      return response.redirect(
        `${mobileRedirect}?success=false&error=authorization_failed`,
      );
    }
  }
}

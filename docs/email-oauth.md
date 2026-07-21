# Email transaction import configuration

The backend supports Gmail and Outlook through OAuth authorization-code flow.
Provider secrets are backend-only and must never be included in the mobile app.

## Environment variables

```env
EMAIL_TOKEN_ENCRYPTION_KEY=replace-with-a-long-random-secret
EMAIL_OAUTH_STATE_SECRET=replace-with-an-independent-random-secret
EMAIL_OAUTH_CALLBACK_URL=https://api.example.com/transactions/email/oauth/callback
NIMMADHI_MOBILE_OAUTH_REDIRECT=nimmadhi://email-connected

GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=

OUTLOOK_CLIENT_ID=
OUTLOOK_CLIENT_SECRET=
```

Use HTTPS for `EMAIL_OAUTH_CALLBACK_URL` outside local development. The value
must exactly match the redirect URI registered with each provider.

## Gmail

1. Enable the Gmail API in Google Cloud.
2. Configure an OAuth consent screen.
3. Create a Web application OAuth client.
4. Register `EMAIL_OAUTH_CALLBACK_URL` as an authorized redirect URI.
5. Add the client ID and secret to the backend environment.

The application requests only
`https://www.googleapis.com/auth/gmail.readonly`.

## Outlook

1. Register an application in Microsoft Entra ID.
2. Add `EMAIL_OAUTH_CALLBACK_URL` as a Web redirect URI.
3. Create a client secret.
4. Add delegated permissions `User.Read` and `Mail.Read`.
5. Add the client ID and secret to the backend environment.

The application also requests `offline_access` for refresh tokens.

## Mobile callback

Android registers `nimmadhi://email-connected`. After changing the manifest,
reinstall the app; Metro hot reload is not sufficient.

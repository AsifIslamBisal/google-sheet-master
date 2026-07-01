import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { config, GOOGLE_SCOPES } from '../config.js';

export const makeOAuthClient = (): OAuth2Client =>
  new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri,
  );

export const buildAuthUrl = (state: string): string => {
  const client = makeOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    state,
    include_granted_scopes: true,
  });
};

export const clientFromRefreshToken = (refreshToken: string): OAuth2Client => {
  const client = makeOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
};

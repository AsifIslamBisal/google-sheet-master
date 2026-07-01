const need = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
};

export const config = {
  port: Number(process.env.PORT ?? 4000),
  publicOrigin: process.env.PUBLIC_ORIGIN ?? 'http://localhost:4000',
  webOrigin:
    process.env.WEB_ORIGIN ??
    process.env.PUBLIC_ORIGIN ??
    'http://localhost:4000',
  google: {
    clientId: need('GOOGLE_CLIENT_ID'),
    clientSecret: need('GOOGLE_CLIENT_SECRET'),
    redirectUri: need('GOOGLE_REDIRECT_URI'),
  },
  sessionSecret: need('SESSION_SECRET'),
  isProd: process.env.NODE_ENV === 'production',
} as const;

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'openid',
  'email',
  'profile',
];

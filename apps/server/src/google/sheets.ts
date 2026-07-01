import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

const SHEETS_ID_RE = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;

export const extractSpreadsheetId = (url: string): string | null => {
  const m = url.match(SHEETS_ID_RE);
  return m ? m[1] ?? null : null;
};

export const readColumnJ = async (
  auth: OAuth2Client,
  spreadsheetId: string,
): Promise<string[]> => {
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'J2:J',
    majorDimension: 'COLUMNS',
  });
  const col = res.data.values?.[0] ?? [];
  return col
    .map((v) => (typeof v === 'string' ? v.trim() : String(v ?? '').trim()))
    .filter((v) => v.length > 0);
};

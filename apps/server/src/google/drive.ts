import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet';

export type DriveFileMeta = {
  id: string;
  name: string;
  mimeType: string;
};

const TIMEOUT_MS = 30_000;

const withTimeout = async <T>(p: Promise<T>, ms: number): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const getFileMeta = async (
  auth: OAuth2Client,
  fileId: string,
): Promise<DriveFileMeta> => {
  const drive = google.drive({ version: 'v3', auth });
  const res = await withTimeout(
    drive.files.get({ fileId, fields: 'id,name,mimeType' }),
    TIMEOUT_MS,
  );
  const { id, name, mimeType } = res.data;
  if (!id || !name || !mimeType) throw new Error('drive metadata incomplete');
  return { id, name, mimeType };
};

export const downloadAsXlsx = async (
  auth: OAuth2Client,
  meta: DriveFileMeta,
): Promise<Buffer> => {
  const drive = google.drive({ version: 'v3', auth });
  if (meta.mimeType === GOOGLE_SHEET_MIME) {
    const res = await withTimeout(
      drive.files.export(
        { fileId: meta.id, mimeType: XLSX_MIME },
        { responseType: 'arraybuffer' },
      ),
      TIMEOUT_MS,
    );
    return Buffer.from(res.data as ArrayBuffer);
  }
  if (meta.mimeType === XLSX_MIME) {
    const res = await withTimeout(
      drive.files.get(
        { fileId: meta.id, alt: 'media' },
        { responseType: 'arraybuffer' },
      ),
      TIMEOUT_MS,
    );
    return Buffer.from(res.data as ArrayBuffer);
  }
  throw new Error(`unsupported mimeType: ${meta.mimeType}`);
};

export const uploadXlsx = async (
  auth: OAuth2Client,
  filename: string,
  buffer: Buffer,
): Promise<{ id: string; webViewLink: string }> => {
  const drive = google.drive({ version: 'v3', auth });
  const { Readable } = await import('node:stream');
  const res = await drive.files.create({
    requestBody: { name: filename, mimeType: XLSX_MIME },
    media: { mimeType: XLSX_MIME, body: Readable.from(buffer) },
    fields: 'id,webViewLink',
  });
  const { id, webViewLink } = res.data;
  if (!id || !webViewLink) throw new Error('upload returned incomplete metadata');
  return { id, webViewLink };
};

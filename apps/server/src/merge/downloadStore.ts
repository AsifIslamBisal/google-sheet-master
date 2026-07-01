import crypto from 'node:crypto';

type Entry = { buffer: Buffer; filename: string; expiresAt: number };

const TTL_MS = 10 * 60 * 1000;
const store = new Map<string, Entry>();

const sweep = (): void => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expiresAt <= now) store.delete(k);
  }
};

setInterval(sweep, 60_000).unref();

export const stashDownload = (buffer: Buffer, filename: string): string => {
  const token = crypto.randomBytes(16).toString('hex');
  store.set(token, { buffer, filename, expiresAt: Date.now() + TTL_MS });
  return token;
};

export const takeDownload = (token: string): Entry | null => {
  sweep();
  return store.get(token) ?? null;
};

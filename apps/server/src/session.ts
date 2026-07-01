import crypto from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';

export type SessionData = {
  refreshToken: string;
  email?: string;
  name?: string;
  picture?: string;
};

const COOKIE_NAME = 'sid';
const ALGO = 'aes-256-gcm';

const keyBuf = crypto.createHash('sha256').update(config.sessionSecret).digest();

const encrypt = (plain: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, keyBuf, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString('base64url')).join('.');
};

const decrypt = (token: string): string | null => {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0]!, 'base64url');
    const tag = Buffer.from(parts[1]!, 'base64url');
    const enc = Buffer.from(parts[2]!, 'base64url');
    const decipher = crypto.createDecipheriv(ALGO, keyBuf, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return null;
  }
};

export const readSession = (req: FastifyRequest): SessionData | null => {
  const raw = req.cookies[COOKIE_NAME];
  if (!raw) return null;
  const plain = decrypt(raw);
  if (!plain) return null;
  try {
    return JSON.parse(plain) as SessionData;
  } catch {
    return null;
  }
};

export const writeSession = (reply: FastifyReply, data: SessionData): void => {
  const token = encrypt(JSON.stringify(data));
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
};

export const clearSession = (reply: FastifyReply): void => {
  reply.clearCookie(COOKIE_NAME, { path: '/' });
};

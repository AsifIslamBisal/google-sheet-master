import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { google } from 'googleapis';
import { buildAuthUrl, makeOAuthClient } from '../google/oauthClient.js';
import { clearSession, readSession, writeSession } from '../session.js';
import { config } from '../config.js';

const STATE_COOKIE = 'oauth_state';

export const registerAuthRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/auth/google', async (_req, reply) => {
    const state = crypto.randomBytes(16).toString('hex');
    reply.setCookie(STATE_COOKIE, state, {
      httpOnly: true,
      secure: config.isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    reply.redirect(buildAuthUrl(state));
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/login/google',
    async (req, reply) => {
      const { code, state, error } = req.query;
      if (error) {
        reply.code(400).send({ error });
        return;
      }
      const expectedState = req.cookies[STATE_COOKIE];
      reply.clearCookie(STATE_COOKIE, { path: '/' });
      if (!code || !state || !expectedState || state !== expectedState) {
        reply.code(400).send({ error: 'invalid_state' });
        return;
      }

      const client = makeOAuthClient();
      const { tokens } = await client.getToken(code);
      if (!tokens.refresh_token) {
        reply.code(400).send({
          error: 'no_refresh_token',
          message:
            'No refresh token returned. Revoke prior access at myaccount.google.com/permissions and try again.',
        });
        return;
      }
      client.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const info = await oauth2.userinfo.get();
      writeSession(reply, {
        refreshToken: tokens.refresh_token,
        email: info.data.email ?? undefined,
        name: info.data.name ?? undefined,
        picture: info.data.picture ?? undefined,
      });

      reply.redirect(config.webOrigin || '/');
    },
  );

  app.get('/auth/me', async (req, reply) => {
    const sess = readSession(req);
    if (!sess) {
      reply.code(401).send({ error: 'unauthenticated' });
      return;
    }
    return {
      email: sess.email ?? null,
      name: sess.name ?? null,
      picture: sess.picture ?? null,
    };
  });

  app.post('/auth/logout', async (_req, reply) => {
    clearSession(reply);
    return { ok: true };
  });
};

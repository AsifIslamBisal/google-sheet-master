import type { FastifyInstance, FastifyReply } from 'fastify';
import { clientFromRefreshToken } from '../google/oauthClient.js';
import { extractSpreadsheetId, readAllRows } from '../google/sheets.js';
import { normalizeRow } from '../merge/normalizeRow.js';
import { checkIgAccount } from '../instagram/checkAccount.js';
import { readSession } from '../session.js';

type IgSseEvent =
  | { type: 'start'; total: number }
  | {
      type: 'result';
      index: number;
      uid: string | null;
      username: string | null;
      active: boolean;
      igUsername?: string;
      reason?: string;
    }
  | {
      type: 'done';
      total: number;
      activeCount: number;
      inactiveCount: number;
      skipped: number;
    }
  | { type: 'fatal'; error: string };

const sendSse = (reply: FastifyReply, event: IgSseEvent): void => {
  reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
};

export const registerIgCheckRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.post<{ Body: { sheetUrl?: string } }>(
    '/ig-check',
    async (req, reply) => {
      const sess = readSession(req);
      if (!sess) {
        reply.code(401).send({ error: 'unauthenticated' });
        return;
      }

      const sheetUrl = req.body?.sheetUrl?.trim();
      if (!sheetUrl) {
        reply.code(400).send({ error: 'sheetUrl required' });
        return;
      }

      const spreadsheetId = extractSpreadsheetId(sheetUrl);
      if (!spreadsheetId) {
        reply.code(400).send({ error: 'not a Google Sheets URL' });
        return;
      }

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const auth = clientFromRefreshToken(sess.refreshToken);

      try {
        const rawRows = await readAllRows(auth, spreadsheetId);

        // normalizeRow দিয়ে Instagram cookie আছে এমন rows ফিল্টার করো
        type IgRow = {
          uid: string | null;
          username: string | null;
          cookie: string;
        };

        const igRows: IgRow[] = [];
        for (const raw of rawRows) {
          const norm = normalizeRow(raw);
          if (!norm) continue;
          // শুধু Instagram cookie (ds_user_id বা sessionid আছে, c_user নেই)
          if (norm.cookie.includes('c_user=')) continue;
          igRows.push({
            uid: norm.userId !== null ? String(norm.userId) : null,
            username: norm.label,
            cookie: norm.cookie,
          });
        }

        sendSse(reply, { type: 'start', total: igRows.length });

        let activeCount = 0;
        let inactiveCount = 0;

        for (let i = 0; i < igRows.length; i++) {
          const row = igRows[i]!;
          const result = await checkIgAccount(row.cookie);

          if (result.active) {
            activeCount++;
          } else {
            inactiveCount++;
          }

          sendSse(reply, {
            type: 'result',
            index: i,
            uid: row.uid,
            username: row.username,
            active: result.active,
            igUsername: result.igUsername,
            reason: result.reason,
          });

          // Rate limiting — প্রতি request-এর মাঝে ছোট delay
          await new Promise((r) => setTimeout(r, 300));
        }

        const skipped = rawRows.length - igRows.length;
        sendSse(reply, {
          type: 'done',
          total: igRows.length,
          activeCount,
          inactiveCount,
          skipped,
        });
      } catch (err) {
        sendSse(reply, {
          type: 'fatal',
          error: err instanceof Error ? err.message : 'unknown error',
        });
      } finally {
        reply.raw.end();
      }
    },
  );
};

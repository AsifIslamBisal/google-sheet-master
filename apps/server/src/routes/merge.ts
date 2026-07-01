import type { FastifyInstance, FastifyReply } from 'fastify';
import { clientFromRefreshToken } from '../google/oauthClient.js';
import { extractSpreadsheetId, readColumnJ } from '../google/sheets.js';
import { downloadAsXlsx, getFileMeta, uploadXlsx } from '../google/drive.js';
import { extractDriveFileId } from '../merge/extractLinks.js';
import { normalizeRow, type NormalizedRow } from '../merge/normalizeRow.js';
import { dedupBlank } from '../merge/dedupBlank.js';
import { buildMergedXlsx, parseXlsxRows } from '../merge/buildXlsx.js';
import { stashDownload, takeDownload } from '../merge/downloadStore.js';
import { readSession } from '../session.js';

type SseEvent =
  | { type: 'start'; totalLinks: number }
  | {
      type: 'file';
      index: number;
      link: string;
      status: 'ok' | 'failed';
      rowsAdded?: number;
      skippedRows?: number;
      reason?: string;
      name?: string;
    }
  | {
      type: 'done';
      totalRows: number;
      blankedRows: number;
      filesOk: number;
      filesFailed: number;
      downloadToken: string;
      filename: string;
      driveLink: string;
    }
  | { type: 'fatal'; error: string };

const sendSse = (reply: FastifyReply, event: SseEvent): void => {
  reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
};

export const registerMergeRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.post<{ Body: { masterUrl?: string } }>('/merge', async (req, reply) => {
    const sess = readSession(req);
    if (!sess) {
      reply.code(401).send({ error: 'unauthenticated' });
      return;
    }
    const masterUrl = req.body?.masterUrl?.trim();
    if (!masterUrl) {
      reply.code(400).send({ error: 'masterUrl required' });
      return;
    }
    const spreadsheetId = extractSpreadsheetId(masterUrl);
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
    const collected: NormalizedRow[] = [];
    let filesOk = 0;
    let filesFailed = 0;

    try {
      const links = await readColumnJ(auth, spreadsheetId);
      sendSse(reply, { type: 'start', totalLinks: links.length });

      for (let i = 0; i < links.length; i++) {
        const link = links[i]!;
        try {
          const fileId = extractDriveFileId(link);
          if (!fileId) throw new Error('not a Drive URL');
          const meta = await getFileMeta(auth, fileId);
          const buf = await downloadAsXlsx(auth, meta);
          const rawRows = await parseXlsxRows(buf);
          let added = 0;
          let skipped = 0;
          for (const r of rawRows) {
            const norm = normalizeRow(r);
            if (!norm) {
              skipped++;
              continue;
            }
            collected.push(norm);
            added++;
          }
          filesOk++;
          sendSse(reply, {
            type: 'file',
            index: i,
            link,
            status: 'ok',
            rowsAdded: added,
            skippedRows: skipped,
            name: meta.name,
          });
        } catch (err) {
          filesFailed++;
          sendSse(reply, {
            type: 'file',
            index: i,
            link,
            status: 'failed',
            reason: err instanceof Error ? err.message : 'unknown error',
          });
        }
      }

      const { rows: finalRows, duplicatesBlanked } = dedupBlank(collected);

      const xlsxBuf = await buildMergedXlsx(finalRows);
      const filename = `merged-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const { webViewLink } = await uploadXlsx(auth, filename, xlsxBuf);
      const downloadToken = stashDownload(xlsxBuf, filename);

      sendSse(reply, {
        type: 'done',
        totalRows: finalRows.length,
        blankedRows: duplicatesBlanked,
        filesOk,
        filesFailed,
        downloadToken,
        filename,
        driveLink: webViewLink,
      });
    } catch (err) {
      sendSse(reply, {
        type: 'fatal',
        error: err instanceof Error ? err.message : 'unknown error',
      });
    } finally {
      reply.raw.end();
    }
  });

  app.get<{ Params: { token: string } }>(
    '/merge/download/:token',
    async (req, reply) => {
      const sess = readSession(req);
      if (!sess) {
        reply.code(401).send({ error: 'unauthenticated' });
        return;
      }
      const entry = takeDownload(req.params.token);
      if (!entry) {
        reply.code(404).send({ error: 'not_found_or_expired' });
        return;
      }
      reply
        .header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        .header(
          'Content-Disposition',
          `attachment; filename="${entry.filename}"`,
        )
        .send(entry.buffer);
    },
  );
};

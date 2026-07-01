import ExcelJS from 'exceljs';
import type { NormalizedRow } from './normalizeRow.js';

export const parseXlsxRows = async (buf: Buffer): Promise<unknown[][]> => {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (wb.xlsx as any).load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const out: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const arr: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      arr[colNumber - 1] = cell.value;
    });
    out.push(arr);
  });
  return out;
};

export const buildMergedXlsx = async (
  rows: NormalizedRow[],
): Promise<Buffer> => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  for (const row of rows) {
    ws.addRow([row.userId, row.label ?? '', row.cookie]);
  }
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
};

import type { NormalizedRow } from './normalizeRow.js';

export type DedupResult = {
  rows: NormalizedRow[];
  duplicatesBlanked: number;
};

export const dedupBlank = (rows: NormalizedRow[]): DedupResult => {
  const seen = new Set<string>();
  let duplicatesBlanked = 0;
  const out = rows.map((row) => {
    if (row.userId == null) return row;
    const key = String(row.userId);
    if (seen.has(key)) {
      duplicatesBlanked++;
      return { ...row, userId: null };
    }
    seen.add(key);
    return row;
  });
  return { rows: out, duplicatesBlanked };
};

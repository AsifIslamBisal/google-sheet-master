export type NormalizedRow = {
  userId: number | string | null;
  label: string | null;
  cookie: string;
};

const COOKIE_MARKER = 'c_user=';

const cellToString = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && v && 'text' in (v as Record<string, unknown>)) {
    return String((v as { text: unknown }).text ?? '');
  }
  if (
    typeof v === 'object' &&
    v &&
    'richText' in (v as Record<string, unknown>)
  ) {
    const rt = (v as { richText?: Array<{ text?: string }> }).richText;
    return (rt ?? []).map((r) => r.text ?? '').join('');
  }
  return String(v);
};

const looksLikeUserId = (s: string): boolean => /^\d{6,}$/.test(s.trim());

export const normalizeRow = (rawCells: unknown[]): NormalizedRow | null => {
  const cells = rawCells.map(cellToString).map((s) => s.trim());

  const cookieIdx = cells.findIndex((c) => c.includes(COOKIE_MARKER));
  if (cookieIdx < 0) return null;
  const cookie = cells[cookieIdx]!;

  const remaining = cells
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => i !== cookieIdx && c.length > 0);

  let userId: number | string | null = null;
  let label: string | null = null;

  for (const { c } of remaining) {
    if (userId === null && looksLikeUserId(c)) {
      userId = /^\d+$/.test(c) && c.length <= 15 ? Number(c) : c;
      continue;
    }
    if (label === null) {
      label = c;
    }
  }

  if (userId === null) {
    for (const { c } of remaining) {
      if (label === c) continue;
      if (looksLikeUserId(c)) {
        userId = /^\d+$/.test(c) && c.length <= 15 ? Number(c) : c;
        break;
      }
    }
  }

  return { userId, label, cookie };
};

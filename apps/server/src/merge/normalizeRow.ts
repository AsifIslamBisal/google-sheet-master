export type NormalizedRow = {
  userId: number | string | null;
  label: string | null;
  cookie: string;
};

// FBR (Facebook) cookie marker
const FB_COOKIE_MARKER = 'c_user=';
// Instagram cookie markers
const IG_COOKIE_MARKERS = ['ds_user_id=', 'sessionid='];

/** কোনো cell থেকে string বানায় */
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

/** 6+ digit number = UID */
const looksLikeUserId = (s: string): boolean => /^\d{6,}$/.test(s.trim());

/**
 * Instagram cookie থেকে ds_user_id এর value বের করে।
 * যেমন: "ds_user_id=12345678; sessionid=abc" → "12345678"
 */
const extractIgUserId = (cookie: string): string | null => {
  const match = /ds_user_id=(\d+)/.exec(cookie);
  return match ? match[1]! : null;
};

/** কোন ধরনের cookie তা detect করে */
const detectCookieIdx = (cells: string[]): number => {
  // FBR (Facebook) cookie
  const fbIdx = cells.findIndex((c) => c.includes(FB_COOKIE_MARKER));
  if (fbIdx >= 0) return fbIdx;
  // Instagram cookie
  const igIdx = cells.findIndex((c) =>
    IG_COOKIE_MARKERS.some((m) => c.includes(m)),
  );
  return igIdx;
};

export const normalizeRow = (rawCells: unknown[]): NormalizedRow | null => {
  const cells = rawCells.map(cellToString).map((s) => s.trim());

  const cookieIdx = detectCookieIdx(cells);
  if (cookieIdx < 0) return null;
  const cookie = cells[cookieIdx]!;

  const isFbCookie = cookie.includes(FB_COOKIE_MARKER);

  const remaining = cells
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => i !== cookieIdx && c.length > 0);

  let userId: number | string | null = null;
  let label: string | null = null;

  if (isFbCookie) {
    // ── Facebook / FBR ──────────────────────────────────────────
    // UID = c_user= এর value (cookie থেকে)
    const fbUidMatch = /c_user=(\d+)/.exec(cookie);
    if (fbUidMatch) {
      const raw = fbUidMatch[1]!;
      userId = raw.length <= 15 ? Number(raw) : raw;
    }

    // remaining cells থেকে username নাও (A block ছাড়া)
    for (const { c } of remaining) {
      if (label === null && !looksLikeUserId(c)) {
        label = c;
        break;
      }
    }

    // label না পেলে UID-like cell থেকে নাও (fallback)
    if (label === null) {
      for (const { c } of remaining) {
        if (userId !== null && String(userId) === c) continue;
        label = c;
        break;
      }
    }
  } else {
    // ── Instagram ───────────────────────────────────────────────
    // UID = ds_user_id= এর value (cookie থেকে)
    const igUid = extractIgUserId(cookie);
    if (igUid) {
      userId = igUid.length <= 15 ? Number(igUid) : igUid;
    }

    // remaining cells থেকে username নাও
    for (const { c } of remaining) {
      if (label === null && !looksLikeUserId(c)) {
        label = c;
        break;
      }
    }

    // label না পেলে fallback
    if (label === null) {
      for (const { c } of remaining) {
        if (userId !== null && String(userId) === c) continue;
        label = c;
        break;
      }
    }

    // Instagram-এ cell-এ আলাদা UID দেওয়া থাকলে সেটাও নাও (cookie-এ না থাকলে)
    if (userId === null) {
      for (const { c } of remaining) {
        if (looksLikeUserId(c)) {
          userId = /^\d+$/.test(c) && c.length <= 15 ? Number(c) : c;
          break;
        }
      }
    }
  }

  return { userId, label, cookie };
};

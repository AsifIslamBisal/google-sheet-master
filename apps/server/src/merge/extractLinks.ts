const ID_PATTERNS: RegExp[] = [
  /\/file\/d\/([a-zA-Z0-9_-]{20,})/,
  /\/document\/d\/([a-zA-Z0-9_-]{20,})/,
  /\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/,
  /\/d\/([a-zA-Z0-9_-]{20,})/,
  /[?&]id=([a-zA-Z0-9_-]{20,})/,
];

export const extractDriveFileId = (url: string): string | null => {
  for (const re of ID_PATTERNS) {
    const m = url.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
};

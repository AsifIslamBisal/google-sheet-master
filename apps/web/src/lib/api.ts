export type Me = {
  email: string | null;
  name: string | null;
  picture: string | null;
};

export const getMe = async (): Promise<Me | null> => {
  const res = await fetch('/auth/me', { credentials: 'include' });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`auth/me failed: ${res.status}`);
  return (await res.json()) as Me;
};

export const logout = async (): Promise<void> => {
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
};

export type MergeEvent =
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

export const startMerge = async (
  masterUrl: string,
  onEvent: (e: MergeEvent) => void,
): Promise<void> => {
  const res = await fetch('/merge', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ masterUrl }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`merge request failed: ${res.status} ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = chunk
        .split('\n')
        .find((l) => l.startsWith('data: '));
      if (!line) continue;
      try {
        onEvent(JSON.parse(line.slice(6)) as MergeEvent);
      } catch {
        // ignore malformed event
      }
    }
  }
};

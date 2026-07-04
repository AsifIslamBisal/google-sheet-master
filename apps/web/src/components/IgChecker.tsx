import { useState } from 'react';
import { startIgCheck, type IgCheckEvent } from '../lib/api';

type AccountResult = {
  index: number;
  uid: string | null;
  username: string | null;
  igUsername?: string;
  active: boolean;
  reason?: string;
};

type DoneSummary = {
  total: number;
  activeCount: number;
  inactiveCount: number;
  skipped: number;
};

export const IgChecker = () => {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<AccountResult[]>([]);
  const [done, setDone] = useState<DoneSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onEvent = (e: IgCheckEvent): void => {
    if (e.type === 'start') {
      setTotal(e.total);
      setResults([]);
      setDone(null);
      setError(null);
      return;
    }
    if (e.type === 'result') {
      setResults((prev) => [
        ...prev,
        {
          index: e.index,
          uid: e.uid,
          username: e.username,
          igUsername: e.igUsername,
          active: e.active,
          reason: e.reason,
        },
      ]);
      return;
    }
    if (e.type === 'done') {
      setDone(e);
      setBusy(false);
      return;
    }
    if (e.type === 'fatal') {
      setError(e.error);
      setBusy(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResults([]);
    setDone(null);
    setTotal(0);
    try {
      await startIgCheck(url.trim(), onEvent);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const activeResults = results.filter((r) => r.active);
  const inactiveResults = results.filter((r) => !r.active);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Form ─────────────────────────────────────────── */}
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm font-medium text-slate-300">
          Instagram accounts sheet URL
        </label>
        <input
          id="ig-sheet-url"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/.../edit"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-violet-500 disabled:opacity-50"
          disabled={busy}
        />
        <button
          id="ig-check-btn"
          type="submit"
          disabled={busy || !url.trim()}
          className="self-start rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-violet-400 transition-colors"
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Checking… ({results.length}/{total})
            </span>
          ) : (
            'Check Accounts'
          )}
        </button>
      </form>

      {/* ── Error ────────────────────────────────────────── */}
      {error ? (
        <div className="rounded-lg border border-red-700 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {/* ── Progress bar ─────────────────────────────────── */}
      {busy && total > 0 ? (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Checking accounts…</span>
            <span>
              {results.length} / {total}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-300"
              style={{ width: `${(results.length / total) * 100}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* ── Done summary ─────────────────────────────────── */}
      {done ? (
        <div className="rounded-xl border border-violet-800 bg-violet-950/20 p-4 text-sm">
          <div className="mb-2 font-semibold text-violet-300">
            Check complete
          </div>
          <div className="flex gap-4 text-slate-300">
            <span>
              Total:{' '}
              <span className="font-medium text-white">{done.total}</span>
            </span>
            <span>
              ✅ Active:{' '}
              <span className="font-medium text-emerald-400">
                {done.activeCount}
              </span>
            </span>
            <span>
              ❌ Inactive:{' '}
              <span className="font-medium text-red-400">
                {done.inactiveCount}
              </span>
            </span>
            {done.skipped > 0 ? (
              <span>
                ⏭ Skipped:{' '}
                <span className="font-medium text-slate-400">
                  {done.skipped}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ── Results ──────────────────────────────────────── */}
      {results.length > 0 ? (
        <div className="flex flex-col gap-3">
          {/* Active accounts */}
          {activeResults.length > 0 ? (
            <details open>
              <summary className="cursor-pointer select-none rounded-lg border border-emerald-800 bg-emerald-950/20 px-3 py-2 text-sm font-medium text-emerald-300">
                ✅ Active ({activeResults.length})
              </summary>
              <div className="mt-2 flex flex-col gap-1 pl-1">
                {activeResults.map((r) => (
                  <ResultRow key={r.index} result={r} />
                ))}
              </div>
            </details>
          ) : null}

          {/* Inactive accounts */}
          {inactiveResults.length > 0 ? (
            <details open>
              <summary className="cursor-pointer select-none rounded-lg border border-red-800 bg-red-950/20 px-3 py-2 text-sm font-medium text-red-300">
                ❌ Inactive / Expired ({inactiveResults.length})
              </summary>
              <div className="mt-2 flex flex-col gap-1 pl-1">
                {inactiveResults.map((r) => (
                  <ResultRow key={r.index} result={r} />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const ResultRow = ({ result }: { result: AccountResult }) => {
  const displayName =
    result.igUsername || result.username || result.uid || `#${result.index + 1}`;
  return (
    <div
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
        result.active
          ? 'bg-emerald-950/10 border border-emerald-900/40'
          : 'bg-red-950/10 border border-red-900/40'
      }`}
    >
      <span className="text-base">{result.active ? '✅' : '❌'}</span>
      <div className="flex flex-col min-w-0">
        <span className="font-medium text-slate-200 truncate">
          {displayName}
        </span>
        {result.uid && result.uid !== displayName ? (
          <span className="text-xs text-slate-500">UID: {result.uid}</span>
        ) : null}
        {!result.active && result.reason ? (
          <span className="text-xs text-red-400">{result.reason}</span>
        ) : null}
      </div>
    </div>
  );
};

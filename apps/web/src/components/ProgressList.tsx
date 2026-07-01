export type FileResult = {
  index: number;
  link: string;
  status: 'ok' | 'failed' | 'pending';
  rowsAdded?: number;
  skippedRows?: number;
  reason?: string;
  name?: string;
};

const truncate = (s: string, n = 80): string =>
  s.length > n ? `${s.slice(0, n)}…` : s;

export const ProgressList = ({
  total,
  results,
}: {
  total: number;
  results: FileResult[];
}) => {
  if (total === 0) return null;
  const okCount = results.filter((r) => r.status === 'ok').length;
  const failCount = results.filter((r) => r.status === 'failed').length;
  return (
    <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-baseline justify-between text-sm">
        <span className="font-medium">Files</span>
        <span className="text-slate-400">
          {okCount + failCount} / {total} · {okCount} ok · {failCount} failed
        </span>
      </div>
      <div className="max-h-80 space-y-1 overflow-auto text-xs">
        {results.map((r) => (
          <div
            key={r.index}
            className="flex items-start gap-2 rounded border border-slate-800 px-2 py-1.5"
          >
            <span
              className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                r.status === 'ok'
                  ? 'bg-emerald-400'
                  : r.status === 'failed'
                    ? 'bg-red-400'
                    : 'bg-slate-500'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-slate-300">
                {r.name ?? truncate(r.link)}
              </div>
              {r.status === 'ok' ? (
                <div className="text-slate-500">
                  +{r.rowsAdded ?? 0} rows
                  {r.skippedRows ? ` · ${r.skippedRows} skipped` : ''}
                </div>
              ) : r.status === 'failed' ? (
                <div className="text-red-400">{r.reason}</div>
              ) : (
                <div className="text-slate-500">queued…</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

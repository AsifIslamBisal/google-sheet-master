import { useEffect, useState } from 'react';
import { getMe, startMerge, type MergeEvent, type Me } from './lib/api';
import { LoginGate } from './components/LoginGate';
import { MergeForm } from './components/MergeForm';
import { ProgressList, type FileResult } from './components/ProgressList';
import { FilenameModal } from './components/FilenameModal';
import { IgChecker } from './components/IgChecker';

type DoneSummary = {
  totalRows: number;
  blankedRows: number;
  filesOk: number;
  filesFailed: number;
  downloadToken: string;
  filename: string;
  driveLink: string;
};

type Tab = 'merge' | 'ig-checker';

const App = () => {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<FileResult[]>([]);
  const [done, setDone] = useState<DoneSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [tab, setTab] = useState<Tab>('merge');

  useEffect(() => {
    getMe()
      .then(setMe)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const onEvent = (e: MergeEvent): void => {
    if (e.type === 'start') {
      setTotal(e.totalLinks);
      setResults(
        Array.from({ length: e.totalLinks }, (_, i) => ({
          index: i,
          link: '',
          status: 'pending' as const,
        })),
      );
      return;
    }
    if (e.type === 'file') {
      setResults((prev) => {
        const next = [...prev];
        next[e.index] = {
          index: e.index,
          link: e.link,
          status: e.status,
          rowsAdded: e.rowsAdded,
          skippedRows: e.skippedRows,
          reason: e.reason,
          name: e.name,
        };
        return next;
      });
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

  const downloadAs = async (filename: string): Promise<void> => {
    if (!done) return;
    const res = await fetch(`/merge/download/${done.downloadToken}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error(`download failed: ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setRenaming(false);
  };

  const onSubmit = async (url: string): Promise<void> => {
    setBusy(true);
    setError(null);
    setDone(null);
    setResults([]);
    setTotal(0);
    try {
      await startMerge(url, onEvent);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-6 p-6">
      <LoginGate me={me} onLogout={() => setMe(null)} />
      {me ? (
        <>
          {/* ── Tab switcher ─────────────────────────────────── */}
          <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
            <TabButton
              id="tab-merge"
              active={tab === 'merge'}
              onClick={() => setTab('merge')}
              icon="🔀"
              label="Merge"
            />
            <TabButton
              id="tab-ig-checker"
              active={tab === 'ig-checker'}
              onClick={() => setTab('ig-checker')}
              icon="📸"
              label="IG Checker"
            />
          </div>

          {/* ── Merge tab ────────────────────────────────────── */}
          {tab === 'merge' ? (
            <>
              <MergeForm onSubmit={onSubmit} busy={busy} />
              {error ? (
                <div className="rounded-lg border border-red-700 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              ) : null}
              <ProgressList total={total} results={results} />
              {done ? (
                <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-4 text-sm">
                  <div className="mb-2 font-medium text-emerald-300">
                    Merge complete
                  </div>
                  <div className="mb-3 text-slate-300">
                    {done.totalRows} rows · {done.blankedRows} duplicates (col A
                    blanked) · {done.filesOk} files ok · {done.filesFailed}{' '}
                    failed
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRenaming(true)}
                      className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950"
                    >
                      Download xlsx
                    </button>
                    <a
                      href={done.driveLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200"
                    >
                      Open in Drive
                    </a>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {/* ── IG Checker tab ───────────────────────────────── */}
          {tab === 'ig-checker' ? <IgChecker /> : null}
        </>
      ) : null}

      {renaming && done ? (
        <FilenameModal
          defaultName={done.filename}
          onConfirm={downloadAs}
          onClose={() => setRenaming(false)}
        />
      ) : null}
    </div>
  );
};

const TabButton = ({
  id,
  active,
  onClick,
  icon,
  label,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) => (
  <button
    id={id}
    type="button"
    onClick={onClick}
    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
      active
        ? 'bg-slate-700 text-white shadow-sm'
        : 'text-slate-400 hover:text-slate-200'
    }`}
  >
    <span>{icon}</span>
    <span>{label}</span>
  </button>
);

export default App;

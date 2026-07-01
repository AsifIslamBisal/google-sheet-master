import { useEffect, useRef, useState } from 'react';

const sanitize = (name: string): string =>
  name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '').trim();

const ensureXlsxExt = (name: string): string =>
  /\.xlsx$/i.test(name) ? name : `${name}.xlsx`;

export const FilenameModal = ({
  defaultName,
  onConfirm,
  onClose,
}: {
  defaultName: string;
  onConfirm: (filename: string) => Promise<void> | void;
  onClose: () => void;
}) => {
  const stripped = defaultName.replace(/\.xlsx$/i, '');
  const [name, setName] = useState(stripped);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const cleaned = sanitize(name);
    if (!cleaned) {
      setError('Filename cannot be empty.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onConfirm(ensureXlsxExt(cleaned));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
      >
        <h2 className="mb-1 text-base font-semibold text-slate-100">
          Download merged xlsx
        </h2>
        <p className="mb-4 text-xs text-slate-400">
          Pick a filename. `.xlsx` is added automatically if missing.
        </p>
        <div className="flex items-stretch overflow-hidden rounded-lg border border-slate-700 bg-slate-950 focus-within:border-slate-500">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
            placeholder="filename"
          />
          <span className="flex items-center bg-slate-800 px-3 text-xs text-slate-400">
            .xlsx
          </span>
        </div>
        {error ? (
          <div className="mt-2 text-xs text-red-400">{error}</div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950 disabled:opacity-50"
          >
            {busy ? 'Downloading…' : 'Download'}
          </button>
        </div>
      </form>
    </div>
  );
};

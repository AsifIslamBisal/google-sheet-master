import { useState } from 'react';

export const MergeForm = ({
  onSubmit,
  busy,
}: {
  onSubmit: (url: string) => void;
  busy: boolean;
}) => {
  const [url, setUrl] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!url.trim() || busy) return;
        onSubmit(url.trim());
      }}
      className="flex flex-col gap-3"
    >
      <label className="text-sm font-medium text-slate-300">
        Master spreadsheet URL
      </label>
      <input
        type="url"
        required
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://docs.google.com/spreadsheets/d/.../edit"
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-slate-500"
        disabled={busy}
      />
      <button
        type="submit"
        disabled={busy || !url.trim()}
        className="self-start rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
      >
        {busy ? 'Merging…' : 'Start merge'}
      </button>
    </form>
  );
};

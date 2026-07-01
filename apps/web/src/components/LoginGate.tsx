import type { Me } from '../lib/api';
import { logout } from '../lib/api';

export const LoginGate = ({
  me,
  onLogout,
}: {
  me: Me | null;
  onLogout: () => void;
}) => {
  if (!me) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-10">
        <h1 className="text-2xl font-semibold">Drive Spreadsheet Merger</h1>
        <p className="max-w-md text-center text-sm text-slate-400">
          Sign in with Google to read the master sheet, download every linked
          spreadsheet, and produce a merged file.
        </p>
        <a
          href="/auth/google"
          className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-200"
        >
          Sign in with Google
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
      <div className="flex items-center gap-3">
        {me.picture ? (
          <img
            src={me.picture}
            alt=""
            className="h-8 w-8 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <div className="text-sm">
          <div className="font-medium">{me.name ?? 'Signed in'}</div>
          <div className="text-slate-400">{me.email}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={async () => {
          await logout();
          onLogout();
        }}
        className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
      >
        Sign out
      </button>
    </div>
  );
};

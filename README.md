# Drive Spreadsheet Merger

Web app that reads Google Drive links from column **J** of a master Google Sheet, downloads every linked spreadsheet (native Google Sheets + uploaded `.xlsx`), normalizes their rows, and produces one merged `.xlsx` — delivered as both a browser download and a copy saved to the user's Drive.

Output shape (3 columns, no header):

| A | B | C |
|---|---|---|
| Facebook user_id | Short label e.g. `bijoy@17` | Cookie string containing `c_user=...` |

Source files where columns B and C are swapped are auto-normalized (cookie is detected by the `c_user=` substring). Duplicate `user_id`s are kept once — for every subsequent occurrence, column A (the user_id) is blanked while the label and cookie are kept, so the operator can see at a glance which rows were suppressed.

---

## Stack

- **Frontend:** React + TypeScript + Tailwind, Vite. Single page.
- **Backend:** Node 20+, Fastify, TypeScript. Encrypted-cookie session, no DB.
- **Google:** `googleapis` SDK (Sheets API for the master sheet, Drive API for download + upload).

```
apps/
  web/     React app          (dev: :3000)
  server/  Fastify backend    (:4000, also serves built web in prod)
docs/
  google-setup.md             ← full Google Cloud / OAuth walkthrough
sample.xlsx                   ← reference output shape
```

---

## Prerequisites

- **Node 20+** and npm (workspaces are used).
- A **Google Cloud project** with the Sheets + Drive APIs enabled and an OAuth client. Step-by-step in [docs/google-setup.md](docs/google-setup.md).
- A Google account that has at least read access to the master sheet you'll be merging from.

---

## Setup

1. **Clone & install:**

   ```bash
   git clone <repo-url> docs-automation
   cd docs-automation
   npm install
   ```

2. **Google Cloud / OAuth:** follow [docs/google-setup.md](docs/google-setup.md) to obtain your `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and to whitelist the redirect URI. Required scopes:
   - `https://www.googleapis.com/auth/spreadsheets.readonly`
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/drive.file`

3. **Create `.env` at the repo root** (copy from [.env.example](.env.example)):

   ```bash
   PORT=4000
   PUBLIC_ORIGIN=http://localhost:4000
   WEB_ORIGIN=http://localhost:3000   # where to redirect the user after OAuth (your Vite frontend)

   GOOGLE_CLIENT_ID=<your client id>.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=<your client secret>
   GOOGLE_REDIRECT_URI=http://localhost:4000/auth/callback

   SESSION_SECRET=<generate with the command below>
   ```

   In production, where the backend serves the SPA on the same host, leave `WEB_ORIGIN` unset — it falls back to `PUBLIC_ORIGIN`.

   Generate the session secret:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

---

## Run (development)

```bash
npm run dev
```

Starts both apps in parallel:

- Backend at http://localhost:4000
- Frontend at http://localhost:3000 (Vite, proxies `/auth`, `/merge`, `/healthz` to the backend)

Open http://localhost:3000 → **Sign in with Google** → paste the master sheet URL → **Start merge**. Progress streams live; when finished, click **Download xlsx** (modal lets you choose a filename) or **Open in Drive**.

---

## Build & run (production)

```bash
npm run build      # builds both apps; web is emitted to apps/web/dist
npm start          # serves backend on $PORT; backend also serves the built web at /
```

For production deployment:

- Set `NODE_ENV=production` so session cookies are issued with `Secure` (requires HTTPS).
- Update `GOOGLE_REDIRECT_URI` and `PUBLIC_ORIGIN` to the deployed host.
- Add the production origin + callback to your OAuth client in Google Cloud Console.

---

## How it works (high level)

1. User signs in. The backend exchanges the auth code for a refresh token and stores it inside an AES-256-GCM encrypted, `httpOnly` cookie. There is no database.
2. User submits the master sheet URL. Backend reads column J via Sheets API, then for each link:
   - Extracts the Drive file ID (handles `/file/d/<id>/`, `/d/<id>/`, `?id=<id>`, `/open?id=<id>`).
   - Fetches metadata to decide: native Google Sheet → export as `.xlsx`; uploaded `.xlsx` → download as media.
   - Parses with exceljs, walks rows, detects the cookie cell (`c_user=`) and normalizes A/B/C ordering.
   - Per-file failures (no access, wrong mime type, timeout) are reported in the progress list and skipped.
3. All collected rows are run through dedup-blank (first occurrence of a `user_id` is kept; later occurrences become empty rows).
4. The merged workbook is built, uploaded to the user's Drive, and held briefly in memory (10 min TTL) so the frontend can download it with a custom filename.

The flow is streamed over Server-Sent Events so the UI shows live progress per file.

---

## Troubleshooting

Most issues are OAuth-related — the troubleshooting section at the bottom of [docs/google-setup.md](docs/google-setup.md) covers them (`Insufficient Permission`, `redirect_uri_mismatch`, test-user restrictions, 7-day refresh token expiry, per-link permission errors that are expected and non-fatal).

For local issues:

- **Port already in use:** `lsof -ti :4000 | xargs kill` (or `:3000` for the frontend).
- **`Missing required env var: GOOGLE_CLIENT_ID`:** confirm `.env` is at the **repo root**, not inside `apps/server/`.

# Google Cloud setup

Step-by-step guide to obtain `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the redirect URI used by this app, plus the APIs that need to be enabled and the scopes that need to be declared.

---

## 1. Create / pick a Google Cloud project

1. Open https://console.cloud.google.com/.
2. Top bar → project dropdown → **New Project**.
3. Name it (e.g. `docs-automation`) → **Create**.
4. Make sure that project is selected in the top bar before continuing.

---

## 2. Enable the required APIs

Open https://console.cloud.google.com/apis/library and enable:

| API | Why this app needs it |
|---|---|
| **Google Sheets API** | Read column J of the master spreadsheet. |
| **Google Drive API** | Download every linked file (native Google Sheets are exported as `.xlsx`; uploaded `.xlsx` files are fetched as media) and upload the merged result back to the user's Drive. |

For each: click the card → **Enable**. Wait a few seconds per enable.

> The `openid`, `email`, `profile` scopes don't need a separate API enabled — they come with OAuth by default.

---

## 3. Configure the OAuth consent screen

Open https://console.cloud.google.com/apis/credentials/consent.

1. **User type:** **External** (or **Internal** if you're on Google Workspace and only want users in your org).
2. Click **Create**.
3. **App information:**
   - App name: `Drive Spreadsheet Merger` (anything).
   - User support email: your email.
   - Developer contact: your email.
   - Logo / app domain can be left blank.
4. **Scopes** → **Add or remove scopes**. Add **all** of the following. If any are missing, Google silently drops them from the issued token even though the app asks for them, and you'll hit `Insufficient Permission` errors:
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/spreadsheets.readonly`
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`

   Save and continue.
5. **Test users** — while the app is in "Testing" mode, **only emails listed here can sign in**. Add the Google account(s) you'll actually use. Save.
6. Summary → **Back to Dashboard**. Leave **Publishing status: Testing** for personal use. Refresh tokens issued in Testing mode expire after 7 days — re-sign in when that happens, or click **Publish App** when you're ready.

---

## 4. Create the OAuth Client ID

Open https://console.cloud.google.com/apis/credentials.

1. **Create Credentials** → **OAuth client ID**.
2. **Application type:** **Web application**.
3. Name: `docs-automation local` (anything).
4. **Authorized JavaScript origins** — add:
   - `http://localhost:4000`
   - `http://localhost:3000`
5. **Authorized redirect URIs** — add:
   - `http://localhost:4000/auth/callback`
   - Add your production URL later (e.g. `https://your-host.com/auth/callback`).
6. **Create**.
7. A modal pops up with **Client ID** and **Client secret**. Copy both immediately — you can re-open them anytime from this same page.

---

## 5. Fill in `.env`

Copy [.env.example](../.env.example) → `.env` at the repo root, then fill the values:

```bash
PORT=4000
PUBLIC_ORIGIN=http://localhost:4000
WEB_ORIGIN=http://localhost:3000

GOOGLE_CLIENT_ID=<paste client id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<paste client secret>
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/callback

SESSION_SECRET=<generated below>
```

Generate the session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 6. Verify

```bash
npm run dev
```

Open http://localhost:3000 → **Sign in with Google**. The consent screen should list three permission lines roughly:

- *See and download all your Google Drive files*
- *See, edit, create, and delete only the specific Google Drive files you use with this app*
- *See your Google Sheets spreadsheets*

If you see those three, scopes are granted correctly and the merge will work.

---

## Troubleshooting

### `Insufficient Permission` immediately when starting a merge

The token doesn't include the Sheets/Drive scopes — this is **not** a sharing problem on the master sheet.

1. Re-check step 3.4 — every scope above must be listed on the consent screen.
2. Force a fresh consent:
   - https://myaccount.google.com/permissions → find your app → **Remove Access**.
   - In the merger UI: **Sign out** → **Sign in with Google** again.
3. Confirm the consent screen now lists the three Drive/Sheets permissions before approving.

### `redirect_uri_mismatch` after Google login

The URL in step 4.5 must match `GOOGLE_REDIRECT_URI` in `.env` exactly — scheme, host, port, path, no trailing slash. Common slip-ups: `http` vs `https`, missing port, trailing `/`.

### `access_denied` / "This app isn't verified" / "Error 403"

You're signing in with an email not on the Test users list in step 3.5. Either add it there, or use one of the listed test accounts.

### "No refresh token returned" on first sign-in

The app forces `prompt=consent`, so this is rare. If it does happen, revoke at https://myaccount.google.com/permissions and sign in again.

### Refresh token suddenly stops working after ~7 days

Apps in **Testing** publishing status (step 3.6) have 7-day refresh-token expiry. Either re-sign in, or **Publish App** to remove the limit.

### Individual J-column links fail with permission errors

This is expected and **not fatal** — links pointing to files your Google account can't access show up in the progress list as **failed** with a reason, and the run continues with the files you do have access to.

---

## Production deployment (later)

When you deploy:

1. Add the production origin to **Authorized JavaScript origins** (step 4.4).
2. Add `https://<prod-host>/auth/callback` to **Authorized redirect URIs** (step 4.5).
3. Update `.env` on the server: `GOOGLE_REDIRECT_URI` and `PUBLIC_ORIGIN`.
4. Set `NODE_ENV=production` so session cookies are issued with `Secure` (requires HTTPS).
5. Decide whether to keep the consent screen in Testing or **Publish App**. Publishing removes the 7-day token expiry and the test-users allowlist; if you request the `drive.readonly` scope it may require Google's verification process for general public use — review https://support.google.com/cloud/answer/13463073.

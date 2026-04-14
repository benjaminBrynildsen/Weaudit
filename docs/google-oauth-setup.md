# Google OAuth Setup

How to configure the Google Cloud OAuth client that Weaudit uses for sign-in.
One-time setup, ~5 minutes.

## 1. Create (or pick) a Google Cloud project

1. Go to https://console.cloud.google.com/
2. Top bar → project picker → **New Project** (or select an existing one).
3. Name it anything. This project does not need to be owned by the
   `weaudit.com` Workspace — your personal Google account is fine.

## 2. Configure the OAuth consent screen

1. In the left nav: **APIs & Services → OAuth consent screen**.
2. User Type → **External**. (Internal is only available for Workspace
   orgs; External works for any user.)
3. Fill in the required fields:
   - App name: `Weaudit`
   - User support email: your email
   - App logo: optional
   - App domain: `https://weaudit.onrender.com`
   - Authorized domain: `onrender.com` (click **+ ADD DOMAIN**)
   - Developer contact: your email
4. Scopes: click **Add or remove scopes**, select `openid`,
   `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
5. Test users: while the app is in "Testing" status, add the Google
   accounts that will sign in (your gmail + a couple of @weaudit.com
   test accounts). Published apps skip this step but require Google
   verification for sensitive scopes.
6. **Save** at each step.

> You can keep the app in "Testing" mode. It shows a warning screen on
> sign-in but otherwise works. Moving to "In production" requires Google
> verification for sensitive scopes, which is overkill for internal apps.

## 3. Create the OAuth 2.0 Client ID

1. Left nav: **APIs & Services → Credentials**.
2. **+ Create Credentials → OAuth client ID**.
3. Application type: **Web application**.
4. Name: `Weaudit Web`.
5. **Authorized JavaScript origins**:
   - `https://weaudit.onrender.com`
   - `http://localhost:5000` (for local dev, optional)
6. **Authorized redirect URIs**:
   - `https://weaudit.onrender.com/auth/google/callback`
   - `http://localhost:5000/auth/google/callback` (for local dev, optional)
7. **Create**. Google shows you a **Client ID** and **Client Secret** —
   copy both, you'll paste them into Render next.

## 4. Add the credentials to Render

1. Render dashboard → the `weaudit` service → **Environment**.
2. You'll see two variables marked "needs value":
   - `GOOGLE_CLIENT_ID` → paste the Client ID from step 3.7
   - `GOOGLE_CLIENT_SECRET` → paste the Client Secret from step 3.7
3. Save. Render will redeploy automatically.

## 5. Verify

1. Go to `https://weaudit.onrender.com/` (or `/login`).
2. Click **Sign in with Google**.
3. You should land on a Google account picker pre-filtered to
   `weaudit.com` accounts. (The `hd` hint we pass in the OAuth request.)
4. Pick an account → you should land on `/dashboard`.

### Troubleshooting

- **"Error 400: redirect_uri_mismatch"** — the callback URL the server
  is sending doesn't match what you registered in step 3.6. Check that
  `BASE_URL` in Render matches the deployed domain, and that
  `<BASE_URL>/auth/google/callback` is listed in Google Cloud.

- **"Access blocked: this app is not verified"** — expected while the
  app is in Testing mode. Click "Advanced → Go to Weaudit (unsafe)" to
  proceed. Only a problem for end-users if you're distributing this
  publicly.

- **Domain gate rejects your login** — check the server log on Render.
  The rejection message includes the reason (wrong hd, unverified
  email, etc.). Add your email to `ALLOWED_EMAIL_OVERRIDES` if you're
  testing from a personal Gmail.

- **"This browser or app may not be secure"** — Google blocks OAuth
  flows in some embedded webviews. Use a real browser.

## Env vars summary

Set in `render.yaml` (committed):
- `BASE_URL` — public app URL, used to build the callback URL
- `ALLOWED_EMAIL_DOMAIN` — `weaudit.com`
- `ALLOWED_EMAIL_OVERRIDES` — comma-separated bypass list

Set in Render dashboard only (not committed):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Auto-managed by Render:
- `SESSION_SECRET` — generated on first deploy
- `DATABASE_URL` — wired from the managed Postgres

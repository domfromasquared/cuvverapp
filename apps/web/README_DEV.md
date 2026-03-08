# Cuvver Web Dev Runbook (Hosted Supabase)

This runbook is for hosted Supabase only. Docker/local Supabase is not required.

## 1) Prerequisites

- Node.js 20+
- npm
- Supabase CLI (`supabase --version`)
- Access to your hosted Supabase project

## 2) Environment

Create `apps/web/.env`:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_<your_key>
VITE_UI_DEBUG=false
```

Reference template: `apps/web/.env.example`

## 3) Run the web app

```bash
cd apps/web
npm install
npm run dev
```

Open: `http://localhost:5173/#/bootstrap`

## 4) Apply DB migrations to hosted project

Run from repo root (the directory that contains `supabase/functions`):

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

## 5) Deploy edge functions (hosted)

Run from repo root:

```bash
supabase functions deploy create-household
supabase functions deploy invite-member
supabase functions deploy accept-invite
supabase functions deploy change-role
supabase functions deploy pin-feed-item
supabase functions deploy unpin-feed-item
supabase functions deploy upsert-coverage-brief
supabase functions deploy create-dm-thread
```

If you run deploy from the wrong folder, CLI fails with:
`Entrypoint path does not exist ... supabase/functions/<fn>/index.ts`

## 6) Required hosted function secrets

In Supabase dashboard -> Edge Functions -> Secrets, set:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_APP_URL` (recommended, e.g. `http://localhost:5173` for dev)

Optional for automatic invite email delivery (Resend):

- `INVITE_EMAIL_PROVIDER` = `resend`
- `RESEND_API_KEY`
- `INVITE_EMAIL_FROM` (e.g. `Cuvver <no-reply@your-domain.com>`)
- `INVITE_EMAIL_SUBJECT_PREFIX` (optional)

## 7) Common errors and fixes

### A) OAuth callback route mismatch in hash router

Symptom:
- `No routes matched location "/access_token=..."`

Fix:
- Keep OAuth redirect at origin root (`http://localhost:5173/`).
- App now normalizes OAuth token/error hashes in `src/main.tsx` and routes to `#/bootstrap` or `#/auth`.

### B) `401 Unauthorized` from edge functions

Symptom:
- `POST .../functions/v1/create-household 401`

Fix:
- Ensure user is signed in.
- Ensure frontend passes bearer token (implemented in service invoke wrappers).
- Ensure function secrets are configured.

### C) CORS preflight blocked on edge function

Symptom:
- Browser CORS error on `OPTIONS` request

Fix:
- Redeploy updated function from repo root.
- Confirm function handles `OPTIONS` and returns CORS headers.

### D) Storage upload 403 / RLS violation

Symptom:
- `new row violates row-level security policy` from `storage/v1/object/...`

Fix:
- Apply `supabase/migrations/0005_audit_fixes.sql` via `supabase db push`.
- Confirm your user role is allowed:
  - documents upload: owner/editor
  - care-update attachments: owner/editor, caregiver when toggle allows

### E) `User from sub claim in JWT does not exist`

Symptom:
- Auth `/user` returns 403, session appears broken

Fix:
- Clear site data for `localhost:5173`.
- Confirm `.env` points to the same project where you signed in.
- Sign in again to issue a token for the active project.

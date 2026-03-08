# Cuvver MVP Monorepo

Cuvver is a private household operations app for families and caregivers.
Brand promise: **You’re covered.**

## Stack
- `apps/web`: Vite + React + TypeScript (hash routing)
- `supabase`: Postgres + Auth + Storage + RLS + Edge Functions

## Repo Layout
- `apps/web` frontend app
- `supabase/migrations` schema, RLS, views, seed
- `supabase/functions` edge functions for privileged actions

## Prerequisites
- Node.js 20+
- npm
- Supabase CLI (`supabase --version`)
- Docker Desktop (required for `supabase start` locally)

## Environment
Create `apps/web/.env`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<from supabase start output>
```

Use `apps/web/.env.example` as template.

## Local Development
1. Start Supabase local stack:
```bash
supabase start
```

2. Apply migrations and seed:
```bash
supabase db reset
```

3. Install and run frontend:
```bash
cd apps/web
npm install
npm run dev
```

4. Open:
`http://localhost:5173/#/bootstrap`

## Hosted Supabase Workflow
If you are pointing frontend at a hosted project:

```bash
supabase login
supabase link --project-ref <project_ref>
supabase db push
supabase functions deploy create-household
supabase functions deploy invite-member
supabase functions deploy accept-invite
supabase functions deploy change-role
supabase functions deploy pin-feed-item
supabase functions deploy unpin-feed-item
supabase functions deploy upsert-coverage-brief
supabase functions deploy create-dm-thread
```

### Optional: automatic invite emails
`invite-member` can send invites directly using Resend.

Set these edge function secrets:

```bash
supabase secrets set INVITE_EMAIL_PROVIDER=resend
supabase secrets set RESEND_API_KEY=<resend_api_key>
supabase secrets set INVITE_EMAIL_FROM="Cuvver <no-reply@your-domain.com>"
supabase secrets set INVITE_EMAIL_SUBJECT_PREFIX="Cuvver"
```

Then redeploy:

```bash
supabase functions deploy invite-member
```

If these are not set, invite links are still generated and can be shared manually.

## Seed Notes
`0004_seed.sql` creates:
- `Hartley Household`
- sample shifts/feed/protocol/coverage brief/PTO/time entry/document record
- memberships if these auth users exist:
  - `owner@hartley.test`
  - `caregiver@hartley.test`

Create those users in Supabase Auth first, then run `supabase db reset`.

## Product Guardrails Implemented
- No public profiles, no discovery, no follower graph, no share links.
- Household-only feed and care updates.
- Roles: `owner`, `editor`, `caregiver`, `viewer`.
- Admin controls enforced by both frontend permission helper and backend RLS/functions.
- Private storage buckets for care update attachments and documents.

## Retention Policy
Retention policy values are stored (30/60/90). Cleanup automation for old files is intentionally TODO for a scheduled job.

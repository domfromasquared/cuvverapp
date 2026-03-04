# Cuvver Full Repo Audit Report (Hosted Supabase)

Date: 2026-03-04  
Scope: `apps/web` + `supabase` (hosted mode only, no Docker/local stack)

## Summary

This audit completed static and wiring verification and applied safe, minimal fixes for:

- TypeScript strict failures (`npm run typecheck`) in `apps/web`
- OAuth hash callback handling in hash-router mode
- Invite link generation for hosted environments
- Missing hosted runbook and integration docs
- RLS hardening and missing-policy coverage via `0005_audit_fixes.sql`
- Document UX error handling for storage/RLS failures
- `.env.example` secret hygiene

Static status after fixes:

- `cd apps/web && npm run typecheck`: pass
- `cd apps/web && npm run build`: pass

Hosted runtime cannot be fully executed from this environment (requires live project interaction), so manual hosted checks are listed below.

---

## Task 0: Inventory + Poisoned File Check

## Repo tree snapshot (depth 4)

```text
/
  apps/
    web/
      docs/
      public/
      src/
        app/
        auth/
        components/
        dev/
        lib/
        pages/
        permissions/
        services/
        state/
        styles/
        types/
        utils/
  supabase/
    functions/
      _shared/
      accept-invite/
      change-role/
      create-dm-thread/
      create-household/
      invite-member/
      pin-feed-item/
      unpin-feed-item/
      upsert-coverage-brief/
    migrations/
      0001_init.sql
      0002_rls.sql
      0003_views.sql
      0004_seed.sql
      0005_audit_fixes.sql
```

## Canonical folders verified

- Frontend pages/components: `apps/web/src/pages`, `apps/web/src/components`
- State/store: `apps/web/src/state`
- Supabase functions: `supabase/functions/*/index.ts`
- Migrations: `supabase/migrations/*.sql`

## Orphans / cleanliness findings

- `apps/web/dist` exists in workspace (build artifact; ignored by `.gitignore`)
- root `package-lock.json` exists alongside `apps/web/package-lock.json` (likely orphan if root npm project is not used)

## Poisoned file check result

- No JSX-in-`.ts` findings requiring repair.
- No SQL files containing TS/React code.
- No TS/TSX files containing SQL DDL content.

No poisoned files were found; no content-type repair was required.

---

## High Severity Findings (fixed)

1. OAuth callback hash route mismatch broke login return path  
Evidence:
- `apps/web/src/main.tsx:10-39` previously normalized only `#error=...`
- Browser logs showed `No routes matched location "/access_token=..."`
Fix applied:
- Added token-hash normalization with `supabase.auth.setSession(...)` and redirect to `#/bootstrap` in `apps/web/src/main.tsx:10-53`.
- Added router wildcard fallback `* -> /bootstrap` in `apps/web/src/app/router.tsx:47`.

2. TypeScript strict mode failed, blocking clean audit baseline  
Evidence:
- `npm run typecheck` failed with env typing, nullable, and invoke payload type issues.
Fixes applied:
- Added Vite env type declaration: `apps/web/src/vite-env.d.ts:1`.
- Fixed edge invoke typing in:
  - `apps/web/src/services/householdApi.ts:17`
  - `apps/web/src/services/feedApi.ts:16`
  - `apps/web/src/services/dmApi.ts:10`
- Fixed nullable and shape handling:
  - `apps/web/src/services/householdApi.ts:53-61`
  - `apps/web/src/services/documentsApi.ts:47-52`
  - `apps/web/src/pages/SettingsPage.tsx:39-49`

3. Hosted invite links were hardcoded to localhost  
Evidence:
- `supabase/functions/invite-member/index.ts` generated `http://localhost:5173/#/auth?invite=...`
Fix applied:
- Added `PUBLIC_APP_URL` usage with localhost fallback in `supabase/functions/invite-member/index.ts:35,45`.

4. RLS helper hardening and missing policies were insufficient for hosted reliability  
Evidence:
- `supabase/migrations/0002_rls.sql:6-53` helper functions lacked `SECURITY DEFINER` and `search_path`.
- Missing/partial coverage for operational tables and storage paths caused failures like document upload `403 RLS`.
Fix applied:
- Added `supabase/migrations/0005_audit_fixes.sql` with:
  - hardened helper functions (`SECURITY DEFINER`, `search_path`)
  - missing/repair policies for `invites`, `dependents`, `time_entries`, `attachments`, `notifications`, `dm_thread_participants`
  - toggle-aware inserts for comments/acknowledgements
  - documents role-based select/write policy split
  - storage bucket policies for `care-updates` and `household-documents` (best-effort block for ownership-constrained hosted SQL contexts)

---

## Medium Severity Findings (fixed)

1. `.env.example` contained real hosted values  
Evidence:
- `apps/web/.env.example` had real project URL + publishable key.
Fix:
- Replaced with placeholders in `apps/web/.env.example:1-3`.

2. Missing hosted dev runbook in app folder  
Evidence:
- `apps/web/README_DEV.md` absent.
Fix:
- Added hosted-only runbook: `apps/web/README_DEV.md`.

3. Documents Vault operations could throw unhandled promise errors in UI  
Evidence:
- `apps/web/src/pages/SettingsPage.tsx` document action callbacks lacked local `try/catch`.
Fix:
- Added guarded toasts around upload/delete/open operations at `apps/web/src/pages/SettingsPage.tsx:221-250`.

---

## Low Severity Findings

1. Root lockfile duplication
- `package-lock.json` at repo root while active app lockfile is `apps/web/package-lock.json`.
- Not changed automatically (safety). Keep one lock strategy per workspace.

2. Build artifact presence in workspace
- `apps/web/dist` present locally.
- `.gitignore` already excludes `dist/`; no code change required.

---

## Task-by-task audit outcome

## Task 1: Environment + runbook

- `.gitignore` env coverage confirmed: `.gitignore:14-17`
- `.env.example` sanitized: `apps/web/.env.example:1-3`
- Hosted runbook added: `apps/web/README_DEV.md`

## Task 2: Build + TS/JSX

- Typecheck pass after fixes.
- Build pass after fixes.
- No `.ts` JSX contamination requiring extension rename.

## Task 3: Routing + providers

- Route inventory verified in `apps/web/src/app/router.tsx:29-48`.
- Added wildcard fallback.
- Providers and store wrapping verified in `apps/web/src/app/providers.tsx`.

## Task 4: Auth

- `signIn`, `signUp`, `signOut`, `signInWithGoogle` wrappers verified in `apps/web/src/auth/authService.ts`.
- OAuth callback normalization fixed in `apps/web/src/main.tsx`.
- Logout path verified in settings: `apps/web/src/pages/SettingsPage.tsx:257-266`.

## Task 5: DB integration + RLS

- Existing baseline reviewed: `supabase/migrations/0001_init.sql`, `0002_rls.sql`, `0003_views.sql`, `0004_seed.sql`.
- Added `0005_audit_fixes.sql` for helper and policy hardening.

## Task 6: Edge functions (CORS/auth)

- All functions checked for:
  - `OPTIONS` handling
  - POST method guard
  - bearer auth checks via `_shared/auth.ts`
  - service-role writes
- Invite link environment fix added.

## Task 7: End-to-end module wiring

Detailed mapping is in `apps/web/docs/INTEGRATION_MAP.md`.

## Task 8: UI/theme hygiene

- CSS-only theme files verified:
  - `apps/web/src/styles/tokens.css`
  - `apps/web/src/styles/base.css`
  - `apps/web/src/styles/components.css`
- Existing `data-ui` instrumentation remains in place; no contamination found.

---

## DB Health Checklist

- Tables exist in `0001_init.sql`: yes
- Views exist in `0003_views.sql`: yes
- Seed guarded for missing auth users in `0004_seed.sql`: yes (`owner_id`/`caregiver_id` null guards)
- RLS helper hardening: added in `0005_audit_fixes.sql`
- Policy gaps patched: added in `0005_audit_fixes.sql`
- Storage policy ownership caveat: handled with best-effort guarded block and explicit notice

---

## Remaining TODOs (manual hosted verification)

1. Apply migrations to hosted project:
- `supabase db push`

2. Redeploy functions after code updates:
- deploy all functions from repo root

3. In hosted dashboard, verify function secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_APP_URL`

4. Execute runtime acceptance checks:
- Google login callback lands on `#/bootstrap`
- Create household no longer 401/CORS
- Documents upload succeeds for owner/editor and fails for viewer
- Members list loads without policy recursion failures

---

## Files changed in this audit

- `apps/web/.env.example`
- `apps/web/src/vite-env.d.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/app/router.tsx`
- `apps/web/src/services/householdApi.ts`
- `apps/web/src/services/feedApi.ts`
- `apps/web/src/services/dmApi.ts`
- `apps/web/src/services/documentsApi.ts`
- `apps/web/src/pages/SettingsPage.tsx`
- `supabase/functions/invite-member/index.ts`
- `supabase/migrations/0005_audit_fixes.sql`
- `apps/web/README_DEV.md`
- `apps/web/docs/INTEGRATION_MAP.md`
- `AUDIT_REPORT.md`

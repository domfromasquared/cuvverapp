# Cuvver Integration Map

This map documents route -> page -> service -> database/edge-function wiring for the hosted Supabase setup.

## Runtime foundation

- Supabase client: `apps/web/src/lib/supabaseClient.ts`
- Auth/session wrappers: `apps/web/src/auth/authService.ts`, `apps/web/src/auth/session.ts`
- Router: `apps/web/src/app/router.tsx`
- App state: `apps/web/src/state/appStore.tsx`

## Route map

| Route | Page component | Key services | Tables/views | Edge functions |
|---|---|---|---|---|
| `#/bootstrap` | `BootstrapPage.tsx` | `ensureProfile`, `listMyHouseholds`, `createHousehold`, `getHouseholdMembers` | `profiles`, `household_members`, `households` | `create-household` |
| `#/auth` | `AuthPage.tsx` | `signIn`, `signUp`, `signInWithGoogle`, `acceptInvite` | `auth.users` (via Supabase Auth) | `accept-invite` |
| `#/app/schedule` | `SchedulePage.tsx` | `listShifts`, `createShift`, `listTimeEntries`, `clockIn`, `clockOut`, `approveTimeEntry`, `createSystemEvent` | `shifts`, `time_entries`, `feed_items` | none |
| `#/app/shift/:shiftId` | `ShiftDetailPage.tsx` | `getShift`, `updateShift` | `shifts` | none |
| `#/app/feed` | `FeedPage.tsx` | `listFeed`, `createCareUpdate`, `uploadCareAttachment`, `upsertCoverageBrief`, `createProtocol`, `pinFeedItem`, `unpinFeedItem` | `feed_items`, `attachments` | `upsert-coverage-brief`, `pin-feed-item`, `unpin-feed-item` |
| `#/app/feed/:feedItemId` | `FeedDetailPanel.tsx` | `listFeed`, `listComments`, `addComment`, `listAcknowledgements`, `acknowledge`, `markSeen`, `listReadReceipts`, `listAttachments` | `feed_items`, `comments`, `acknowledgements`, `read_receipts`, `attachments` | none |
| `#/app/pto` | `PtoPage.tsx` | `listPto`, `requestPto`, `createSystemEvent` | `pto_requests`, `feed_items` | none |
| `#/app/pto/:ptoId` | `PtoDetailPage.tsx` | `listPto`, `decidePto`, `createSystemEvent` | `pto_requests`, `feed_items` | none |
| `#/app/settings` | `SettingsPage.tsx` | `updateHousehold`, `getHouseholdMembers`, `inviteMember`, `changeRole`, `listDocuments`, `uploadDocument`, `removeDocument`, `getDocumentSignedUrl`, `signOut` | `households`, `household_members`, `profiles`, `documents`, `storage.objects` | `invite-member`, `change-role` |
| `#/app/dm` | `DmPanel.tsx` | `createDmThread`, `listThreads`, `listMessages`, `sendMessage` | `dm_threads`, `dm_thread_participants`, `dm_messages` | `create-dm-thread` |

## Edge function contracts used by web

- `create-household`: create household + owner membership.
- `invite-member`: create invite token and invite link.
- `accept-invite`: accept token and create membership.
- `change-role`: owner/editor role management with owner protections.
- `pin-feed-item` / `unpin-feed-item`: pin controls.
- `upsert-coverage-brief`: single pinned coverage brief upsert.
- `create-dm-thread`: contextual DM scaffold creation.

All edge function invocations from web use bearer token forwarding in service wrappers:
- `apps/web/src/services/householdApi.ts`
- `apps/web/src/services/feedApi.ts`
- `apps/web/src/services/dmApi.ts`

## Permission and gating map

- Frontend role/toggle gating: `apps/web/src/permissions/permissionHelper.ts`
- Backend enforcement: RLS policies in:
  - `supabase/migrations/0002_rls.sql`
  - `supabase/migrations/0005_audit_fixes.sql`

Key gates:
- Care update posting and attachment uploads: caregiver role + household toggles.
- Comment/acknowledge: role + toggles.
- Documents:
  - owner/editor upload/delete
  - caregiver view-only
  - viewer blocked
- Role change and invite actions: owner/editor via edge functions.
- Owner-only safeguards handled in `change-role` function logic.

## Storage bucket paths

- Care updates bucket: `care-updates/<household_id>/<feed_item_id>/<filename>`
- Documents bucket: `household-documents/<household_id>/<filename>`

Policies for both are in `supabase/migrations/0005_audit_fixes.sql` (best-effort for hosted ownership constraints on `storage.objects`).

## OAuth and hash-router interaction

- OAuth hash normalization lives in `apps/web/src/main.tsx`.
- Cases handled:
  - `#error=...` -> `#/auth?oauth_error=...`
  - `#access_token=...&refresh_token=...` -> session set -> `#/bootstrap`
- Wildcard route fallback to `#/bootstrap` exists in `apps/web/src/app/router.tsx`.

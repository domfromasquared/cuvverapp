# Cuvver UI Map + Component Inventory

## Title + Purpose
This document maps the current Cuvver web UI as implemented in `apps/web` (Vite + React + TypeScript), including routes, component hierarchy, controls, data flow, Supabase integration, permission gating, and runtime states.

Scope:
- Documentation of existing behavior only.
- Dev-only UI instrumentation (`VITE_UI_DEBUG`) and stable `data-ui` anchors for QA.
- No product redesign and no behavior changes.

## How To Run (Dev)
From repo root:

```bash
cd apps/web
npm install
npm run dev
```

App uses hash routing (`#/...`) and mounts at `http://localhost:5173` by default.

## Environment Flags (UI Debug)
File: `apps/web/.env` (or `.env.local`)

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_UI_DEBUG=true
```

- `VITE_UI_DEBUG=true` enables corner debug badges for major wrappers/modules/modals.
- Badge source:
  - `apps/web/src/dev/uiDebug.ts`
  - `UI_DEBUG` boolean reads from `import.meta.env.VITE_UI_DEBUG`
  - `debugBadge(name, path)` renders `Component - src/path.tsx`

## Route Map
| Route | Component | File |
|---|---|---|
| `/#/` | Redirect to `/bootstrap` | `src/app/router.tsx` |
| `/#/bootstrap` | BootstrapPage | `src/pages/BootstrapPage.tsx` |
| `/#/auth` | AuthPage | `src/pages/AuthPage.tsx` |
| `/#/app/schedule` | SchedulePage | `src/pages/SchedulePage.tsx` |
| `/#/app/shift/:shiftId` | ShiftDetailPage | `src/pages/ShiftDetailPage.tsx` |
| `/#/app/feed` | FeedPage | `src/pages/FeedPage.tsx` |
| `/#/app/feed/:feedItemId` | FeedDetailPanel | `src/pages/FeedDetailPanel.tsx` |
| `/#/app/pto` | PtoPage | `src/pages/PtoPage.tsx` |
| `/#/app/pto/:ptoId` | PtoDetailPage | `src/pages/PtoDetailPage.tsx` |
| `/#/app/settings` | SettingsPage | `src/pages/SettingsPage.tsx` |
| `/#/app/dm?context_type=...&context_id=...` | DmPanel | `src/pages/DmPanel.tsx` |

Router/layer notes:
- Router: `createHashRouter` in `src/app/router.tsx`.
- `/app/*` routes are wrapped by `AppShell`.
- `AppLayout` redirects to `/bootstrap` if no selected household in store.

## Global Layout Map (AppShell)
### Component
- `AppShell` (`src/components/layout/AppShell.tsx`)
- `BottomTabs` (`src/components/layout/BottomTabs.tsx`)

### Visual hierarchy tree
```text
div.app[data-ui=layout-app-shell]
  header.header[data-ui=layout-app-shell-header]
    p.kicker (role)
    h1 (household name)
    p.caption ("You're covered.")
  main.page.stack[data-ui=layout-app-shell-main]
    route page content
  nav.tabs[data-ui=layout-bottom-tabs]
    NavLink tab-schedule
    NavLink tab-feed
    NavLink tab-pto
    NavLink tab-settings
```

### Controls inventory
- Tabs (`Schedule`, `Feed`, `PTO`, `Settings`)
- Behavior: route navigation via `NavLink` to `/app/...`.
- Active state: `.tab.active` from `NavLink` state.

### Data used
- `household.name`, `role` from app store (`useAppStore`).

### Global feedback and overlays
- Toast stack host: `ToastHost` in `src/components/common/ToastHost.tsx`.
- Toast trigger API: `pushToast(message)` from `useUi()` (`src/app/providers.tsx`).

## Pages

## /bootstrap
### Component
- `BootstrapPage` (`src/pages/BootstrapPage.tsx`)

### Visual hierarchy tree
```text
div.app.page.stack[data-ui=page-bootstrap|page-bootstrap-needs-household|page-bootstrap-empty]
  Card (loading or onboarding)
    h2
    p.caption
    form[data-ui=bootstrap-household-create-form] (if no household)
      input[name=name]
      input[name=timezone]
      button "Create household"
```

### Controls inventory
- Input `Household name`
  - id: `household-name`
  - placeholder: `Hartley Household`
  - validation: required + trimmed non-empty.
  - write target: `create-household` edge function payload `household_name`.
- Input `Timezone`
  - id: `household-timezone`
  - default: `America/Los_Angeles`
  - write target: `create-household` payload `timezone`.
- Button `Create household`
  - enabled: form valid.
  - click behavior:
    1. Calls `createHousehold({ household_name, timezone })` (`householdApi`).
    2. Refreshes households `listMyHouseholds()`.
    3. Loads members `getHouseholdMembers()`.
    4. Updates app store and navigates to `/app/schedule`.
  - success UX: toast `Household created.`
  - error UX: toast from caught error.

### Data + services used
- Reads:
  - Supabase auth session/user via `getSession()`, `getCurrentUser()`.
  - `household_members` join query via `listMyHouseholds()`.
- Writes:
  - `profiles` via `ensureProfile()` upsert.
  - `create-household` edge function.
- Local state:
  - `loading`, `needsHousehold`.

### Permission + gating
- Requires authenticated session.
- No explicit role check on this screen.
- If no session/user: redirect to `/auth`.

### States
- Loading card: `Preparing Cuvver`.
- Onboarding form: only when user has no households.
- Empty fallback wrapper when bootstrap resolves quickly.

### Modals/drawers
- None.

## /auth
### Component
- `AuthPage` (`src/pages/AuthPage.tsx`)

### Visual hierarchy tree
```text
div.app.page.stack[data-ui=page-auth]
  Card[data-ui=auth-signin-card]
    brand header
    form[data-ui=auth-signin-form]
      input email
      input password
      button "Sign in"
    button[data-ui=auth-signin-google-button] "Continue with Google"
  Card[data-ui=auth-signup-card]
    form[data-ui=auth-signup-form]
      input display_name
      input email
      input password
      button "Create account"
    button[data-ui=auth-signup-google-button] "Sign up with Google"
```

### Controls inventory
- Sign-in email input
  - label: `Email`
  - type: `email`
  - validation: `isEmail(email)`.
  - write target: `signIn(email, password)`.
- Sign-in password input
  - label: `Password`
  - type: `password`
  - validation: required.
- Button `Sign in`
  - click behavior:
    1. Validate email/password.
    2. `signIn(email, password)`.
    3. If query `invite` exists, `acceptInvite({ token })`.
    4. Navigate to `/bootstrap`.
  - errors: toast `Enter a valid email and password.` or API error text.
- Button `Continue with Google`
  - behavior: `signInWithGoogle()` (`supabase.auth.signInWithOAuth`).
  - redirect target configured in code: `${window.location.origin}/#/bootstrap`.
  - after call, attempts `maybeAcceptInvite()` and route bootstrap.
  - error: toast `Google sign-in failed.`.
- Signup display name input
  - label: `Display name`
  - validation: non-empty.
- Signup email input
  - validation: `isEmail`.
- Signup password input
  - minLength: `8`
  - validation: `password.length >= 8`.
- Button `Create account`
  - behavior:
    1. `signUp(displayName, email, password)`.
    2. `signIn(email, password)`.
    3. Optional invite accept.
    4. Navigate `/bootstrap`.
- Button `Sign up with Google`
  - behavior mirrors Google sign-in.

### Data + services used
- Auth API: `supabase.auth.signInWithPassword`, `signUp`, `signInWithOAuth`.
- Edge function: `accept-invite` (optional, query param driven).

### Permission + gating
- Public route.

### States
- No explicit loading spinner.
- Errors surfaced in toast host.

### Modals/drawers
- None.

## /app/schedule
### Component
- `SchedulePage` (`src/pages/SchedulePage.tsx`)

### Visual hierarchy tree
```text
div.stack[data-ui=page-schedule]
  Card[data-ui=schedule-create-card]
    h2 + caption
    form[data-ui=schedule-create-form]
      input title
      input start datetime-local
      input end datetime-local
      input recurrence
      textarea notes
      button "Create shift"
  section.stack[data-ui=schedule-agenda-section]
    EmptyState or day cards
    Card[data-ui=schedule-agenda-day-card]
      day kicker
      list[data-ui=schedule-agenda-day-list]
        item[data-ui=schedule-agenda-item]
          title
          range text
          link "Open shift"
  Card[data-ui=schedule-time-clock-card]
    list[data-ui=schedule-time-clock-list]
      item[data-ui=schedule-time-entry-item]
        status, actions
    button "Clock in (first shift)"
```

### Controls inventory
- Create shift form inputs
  - `Title` (required)
  - `Start`/`End` (`datetime-local`, validated by `isValidRange`)
  - `Recurrence rule` placeholder: `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`
  - `Notes` (optional)
- Button `Create shift`
  - behavior:
    1. `createShift(...)` insert into `shifts`.
    2. `createSystemEvent(...)` insert into `feed_items` type `system_event` (critical).
    3. Refresh shift list.
  - success: toast `Shift created.`
  - errors: toast from catch.
- Link `Open shift`
  - route `/app/shift/:id`.
- Time entry button `Clock out`
  - visible when `entry.status === "open"` and entry belongs to current profile.
  - behavior: `clockOut(entry.id)` then refresh list.
- Time entry button `Approve`
  - visible when `entry.status === "submitted"` and `PermissionHelper.canApprovePto(role)`.
  - behavior: `approveTimeEntry(entry.id)` then refresh list.
- Button `Clock in (first shift)`
  - behavior: if no shifts, toast `Create a shift first.`.
  - otherwise `clockIn(household.id, shifts[0].id, profile.id)`.

### Lists/tables
- Shift fetch sort: `start_datetime ASC` (`listShifts`).
- Agenda groups by date (`YYYY-MM-DD`) and group keys sorted ascending.
- Time entries sort: `created_at DESC`.
- Empty state: `No shifts` card body.

### Data + services used
- Tables:
  - `shifts`, `time_entries`, `feed_items`.
- Service functions:
  - `listShifts`, `createShift`, `listTimeEntries`, `clockIn`, `clockOut`, `approveTimeEntry`, `createSystemEvent`.

### Permission + gating
- UI gating for approve button via `canApprovePto(role)`.
- No UI gating currently on create shift form (all authenticated household members can attempt).

### States
- No explicit loading spinner; lists appear after `useEffect` fetch.
- Validation toast for invalid ranges.

### Modals/drawers
- None.

## /app/shift/:shiftId
### Component
- `ShiftDetailPage` (`src/pages/ShiftDetailPage.tsx`)

### Visual hierarchy tree
```text
Card[data-ui=page-shift-detail|page-shift-detail-loading]
  h2
  form[data-ui=shift-detail-form]
    title, start, end, recurrence, notes
    button "Save"
    link "Message about this shift"
```

### Controls inventory
- Editable fields:
  - `Title`
  - `Start` (`datetime-local`)
  - `End` (`datetime-local`)
  - `Recurrence rule`
  - `Notes`
- Button `Save`
  - behavior: `updateShift(shiftId, patch)` and refresh local state.
  - success: toast `Shift updated.`
  - error: toast.
- Link `Message about this shift`
  - route `/app/dm?context_type=shift&context_id=<shift.id>`.

### Data + services used
- Reads: `getShift(shiftId)` from `shifts`.
- Writes: `updateShift` to `shifts`.

### Permission + gating
- No local UI gating.
- Backend RLS determines final write permission.

### States
- Loading card while shift fetch resolves.

### Modals/drawers
- None.

## /app/feed
### Component
- `FeedPage` (`src/pages/FeedPage.tsx`)

### Visual hierarchy tree
```text
div.stack[data-ui=page-feed]
  Card[data-ui=feed-header-card]
  Card[data-ui=feed-compose-card] (conditional)
    form[data-ui=feed-compose-form]
  Card[data-ui=feed-pinned-controls-card] (conditional)
    form[data-ui=feed-coverage-brief-form]
    form[data-ui=feed-protocol-form]
  PinnedSection[data-ui=module-pinned-section]
  section[data-ui=feed-recent-section]
    list[data-ui=feed-recent-list]
      FeedItemCard[data-ui=module-feed-item-card]
  Card[data-ui=feed-dm-card]
    link "Message about a care update"
```

### Controls inventory
- Care Update composer (visible only if `canPostCareUpdate`):
  - Input `Title` required.
  - Textarea `Message` required.
  - Select `Template tag` options:
    - `None`, `Park`, `Homework`, `Meal`, `Medication`, `Outing`.
  - Input `Attachments`:
    - type file, `accept="image/*"`, `multiple`.
    - disabled if `canUploadAttachment` is false.
  - Checkbox `Mark as critical`.
  - Button `Post Care Update`.
  - Behavior:
    1. Validate title/body and max files <= 3.
    2. `createCareUpdate` insert into `feed_items`.
    3. Optional `uploadCareAttachment` for each file.
    4. Refresh feed.
  - Success: toast `Care update posted.`
  - Errors: toast.
- Pinned controls (visible only if admin):
  - Coverage Brief form:
    - `Coverage Brief title` default `Coverage Brief`
    - `Coverage Brief body` placeholder emergency/pickup/rules text.
    - Button `Save Coverage Brief`.
    - Behavior: `upsertCoverageBrief` edge function, refresh feed.
  - Protocol form:
    - `New Pinned Protocol title`
    - `Protocol body`
    - Checkbox `Critical protocol` default checked.
    - Button `Create protocol`.
    - Behavior: direct `createProtocol` insert (`feed_items`), refresh feed.
- Pinned section controls:
  - `Open` button per feed item -> `/app/feed/:id`.
  - `Pin` / `Unpin` button if admin.
  - Behavior: edge function `pin-feed-item` / `unpin-feed-item`.
- Button-like link:
  - `Message about a care update` -> `/app/dm?context_type=feed_item&context_id=new`.

### Lists/tables
- Feed query sort: `is_pinned DESC`, then `created_at DESC`.
- UI split:
  - `Pinned` section (`item.is_pinned === true`).
  - `Recent` section (`item.is_pinned === false`).
- Empty state: `No feed activity`.

### Data + services used
- Tables:
  - `feed_items`, `attachments`.
- Storage:
  - bucket `care-updates` for upload/signing.
- Edge functions:
  - `upsert-coverage-brief`, `pin-feed-item`, `unpin-feed-item`.

### Permission + gating
- `canPostCareUpdate(role, admin_controls)` gates composer visibility.
- `canUploadAttachment(role, admin_controls)` gates file input disabled state.
- `canAdminHousehold(role)` gates pin/pinned controls.

### States
- No explicit loading skeleton.
- Validation toasts for missing fields and >3 files.

### Modals/drawers
- None at this route.

## /app/feed/:feedItemId
### Component
- `FeedDetailPanel` (`src/pages/FeedDetailPanel.tsx`)

### Visual hierarchy tree
```text
div.stack[data-ui=page-feed-detail]
  Card[data-ui=feed-detail-card]
    title/body
    acknowledgement buttons
    link "Message about this care update"
    ack summary
  Card[data-ui=feed-detail-attachments-card]
    list[data-ui=feed-detail-attachments-list]
      item[data-ui=feed-detail-attachment-item]
        link "Open attachment"
  Card[data-ui=feed-detail-comments-card]
    list[data-ui=feed-detail-comments-list]
    form[data-ui=feed-detail-comment-form] (conditional)
  SeenByDrawer[data-ui=module-seen-by-drawer] (critical only)
```

### Controls inventory
- Acknowledgement buttons (if `canAcknowledge`):
  - Labels: `seen`, `thanks`, `love`, `got it`.
  - Behavior: `acknowledge({...kind})` upsert into `acknowledgements`; refresh ack list.
- Link `Message about this care update` -> `/app/dm?context_type=feed_item&context_id=<item.id>`.
- Attachment link `Open attachment`
  - Behavior: open signed URL in new tab (`target="_blank"`).
- Comment input `Add comment` + button `Send comment` (if `canComment`)
  - Behavior: `addComment`, refresh comments, reset form.

### Lists/tables
- Comments sort: `created_at ASC`.
- Attachments fetched then signed URLs generated per row.
- Receipts list displayed for critical items only.

### Data + services used
- Tables:
  - `feed_items`, `comments`, `acknowledgements`, `attachments`, `read_receipts`.
- Storage:
  - signed URLs from `care-updates`.
- Behavior:
  - On load critical item: `markSeen` upsert then `listReadReceipts`.

### Permission + gating
- `canAcknowledge(role, controls)` for acknowledgement buttons.
- `canComment(role, controls)` for comment form.

### States
- If item missing: `EmptyState` with `Feed item not found`.
- No spinner while detail fetch executes.

### Modals/drawers
- SeenBy is rendered as a card section (`SeenByDrawer`), not animated drawer.
- Attachment viewer is external tab, not modal.

## /app/pto
### Component
- `PtoPage` (`src/pages/PtoPage.tsx`)

### Visual hierarchy tree
```text
div.stack[data-ui=page-pto]
  Card[data-ui=pto-request-card]
    form[data-ui=pto-request-form]
  section[data-ui=pto-requests-section]
    EmptyState or list[data-ui=pto-requests-list]
      item[data-ui=pto-request-item]
        links "Open" and optional "Message about this PTO"
```

### Controls inventory
- PTO form inputs:
  - `Start date` (required date)
  - `End date` (required date)
  - `Type` select: `vacation`, `sick`, `personal`, `other`
  - `Note` textarea
- Button `Request PTO`
  - validation: start/end exist and `start <= end`.
  - behavior:
    1. `requestPto` insert row with `pending`.
    2. `createSystemEvent` with `PTO requested`.
    3. Refresh PTO list.
  - success: toast `PTO request submitted.`
- List link `Open` -> `/app/pto/:id`.
- List link `Message about this PTO`
  - visible if `canApprovePto(role)`.
  - route `/app/dm?context_type=pto&context_id=<id>`.

### Lists/tables
- PTO list sort: `created_at DESC`.
- Empty state: `No PTO requests`.
- Row badge class based on status.

### Data + services used
- Tables:
  - `pto_requests`, `feed_items`.

### Permission + gating
- Approver-only DM link gated by `canApprovePto(role)`.
- Request form shown to all logged-in members.

### States
- No loading spinner.
- Validation and success/error toasts.

### Modals/drawers
- None.

## /app/pto/:ptoId
### Component
- `PtoDetailPage` (`src/pages/PtoDetailPage.tsx`)

### Visual hierarchy tree
```text
Card[data-ui=page-pto-detail|page-pto-detail-loading]
  summary fields
  action row
    button "Approve" (conditional)
    button "Deny" (conditional)
    link "Message about this PTO"
```

### Controls inventory
- Button `Approve`
  - visible when role can approve and status is `pending`.
  - behavior: `decidePto(...approved...)`, `createSystemEvent("PTO approved")`, toast.
- Button `Deny`
  - same gating as approve.
  - behavior: `decidePto(...denied...)`, system event, toast.
- Link `Message about this PTO` -> DM route.

### Data + services used
- Reads list and finds selected item (`listPto`).
- Writes `pto_requests` via `decidePto` and `feed_items` system event.

### Permission + gating
- Approve/deny gated by `canApprovePto(role)` and `status === pending`.

### States
- Loading card before request is loaded.

### Modals/drawers
- None.

## /app/settings
### Component
- `SettingsPage` (`src/pages/SettingsPage.tsx`)

### Visual hierarchy tree
```text
div.stack[data-ui=page-settings]
  Card[data-ui=settings-household-card]
    form[data-ui=settings-household-form]
      quiet hours
      retention
      notification toggles
      admin controls toggles (conditional)
      button "Save settings"
  Card[data-ui=settings-members-card]
    list[data-ui=settings-members-list]
      item[data-ui=settings-member-item]
        role select or static role text
    form[data-ui=settings-invite-form] (conditional)
  Card[data-ui=settings-documents-card]
    EmptyState or UploadDocumentForm + DocumentsList
  Card[data-ui=settings-session-card]
    button "Logout"
```

### Controls inventory
- Household form inputs:
  - Quiet hours:
    - `Quiet hours start` (`time`)
    - `Quiet hours end` (`time`)
  - Retention policy select:
    - `30 days`, `60 days`, `90 days`
  - Notification toggles:
    - `Care Update notifications`
    - `Schedule notifications`
    - `PTO notifications`
  - Admin controls toggles (only admin UI):
    - `Caregivers can post care updates`
    - `Caregivers can upload attachments`
    - `Caregivers can comment`
    - `Viewers can acknowledge`
    - `Viewers can comment`
    - `Require acknowledgement for critical items`
    - `Enable contextual DMs (scaffold)`
  - Button `Save settings`
    - behavior: `updateHousehold(household.id, patch)`.
    - success: toast `Settings saved.`
- Members list controls:
  - Admin sees role `<select>` with `owner/editor/caregiver/viewer` options.
  - Non-admin sees static `Role: ...` caption.
  - Guard in UI: non-owner cannot change owner role (`ownerGuard`).
  - On change: `changeRole` edge function and refresh list.
- Invite form (admin only):
  - Input `Invite by email` (email)
  - Select `Role` options: `editor`, `caregiver`, `viewer`
  - Button `Create invite`
  - behavior: `inviteMember` edge function.
  - success: toast includes invite link string.
- Documents section:
  - Upload form (owner/editor only):
    - `Title` required
    - `Category` placeholder `General`
    - `File` required
    - Button text: `Upload document` / `Uploading...`
  - Document list item buttons:
    - `Open` -> signed URL in new tab.
    - `Delete` (admin only).
- Button `Logout`
  - behavior: `signOut()` then `window.location.hash = "#/auth"`.

### Lists/tables
- Members list order: `created_at ASC`.
- Documents list sort: `created_at DESC`.
- Documents empty state currently rendered by list container only when there are no rows in list (no explicit message in list component).

### Data + services used
- Tables:
  - `households`, `household_members`, `documents`, `profiles` (joined in members API).
- Storage:
  - bucket `household-documents` for file upload/remove/signed URLs.
- Edge functions:
  - `change-role`, `invite-member`.

### Permission + gating
- `canAdminHousehold(role)`:
  - shows admin controls section and member role/invite actions.
- `canManageDocuments(role)`:
  - upload/delete docs.
- `canViewDocuments(role)`:
  - owner/editor/caregiver may view; viewers blocked with `No access` state.

### States
- No explicit loading skeleton.
- Errors caught in toasts for settings/member/invite/document actions.

### Modals/drawers
- None.

## /app/dm (scaffold)
### Component
- `DmPanel` (`src/pages/DmPanel.tsx`)

### Visual hierarchy tree
```text
div.stack[data-ui=page-dm-panel]
  Card[data-ui=dm-context-card]
    context text
    button "Start thread"
  Card[data-ui=dm-threads-card]
    list[data-ui=dm-threads-list] of thread buttons
  Card[data-ui=dm-messages-card]
    list[data-ui=dm-messages-list]
      item[data-ui=dm-message-item]
    form[data-ui=dm-compose-form] (if thread selected)
```

### Controls inventory
- Button `Start thread`
  - behavior: `createDmThread` edge function, refresh thread list, select created thread.
- Thread buttons `Thread <idprefix>`
  - behavior: set selected thread id.
- Message input `Message` + button `Send`
  - behavior: `sendMessage(threadId, profile.id, body)`, refresh messages.

### Data + services used
- Tables:
  - `dm_threads`, `dm_thread_participants`, `dm_messages`, `households` (toggle check in edge function).
- Edge function:
  - `create-dm-thread`.

### Permission + gating
- Page enabled only when:
  - query has both `context_type` and `context_id`, and
  - `PermissionHelper.canOpenDm(role, controls)` is true.
- `canOpenDm` requires:
  - `admin_controls.dms_enabled = true`, and
  - role in `owner/editor/caregiver`.
- If disabled, shows `EmptyState` message.

### States
- No spinner for thread/message fetches.
- Error toast on thread creation failure.

### Modals/drawers
- None.

## Shared Components Inventory

## Primitives
- `Button` (`src/components/common/Button.tsx`)
  - Variants: `primary`, `secondary`, `ghost`, `danger`.
  - Pass-through button props.
- `Card` (`src/components/common/Card.tsx`)
  - Wrapper `section.card`; now supports standard HTML attributes (including `data-ui`).
- `EmptyState` (`src/components/common/EmptyState.tsx`)
  - Standard title/body fallback block.
- `ToastHost` (`src/components/common/ToastHost.tsx`)
  - Displays transient top-right toasts.
- `Modal` (`src/components/common/Modal.tsx`)
  - Not used in current route pages.
  - Behavior if used:
    - Opens as bottom sheet style.
    - Click backdrop closes.
    - Click inside modal does not close.
    - Escape key handling: not implemented.

## Feed modules
- `FeedItemCard` (`src/components/feed/FeedItemCard.tsx`)
  - Shows type/time/title/body + actions.
- `PinnedSection` (`src/components/feed/PinnedSection.tsx`)
  - Renders pinned list and delegates actions.
- `SeenByDrawer` (`src/components/feed/SeenByDrawer.tsx`)
  - Displays read receipts list for critical items.

## Documents modules
- `UploadDocumentForm` (`src/components/documents/UploadDocumentForm.tsx`)
- `DocumentsList` (`src/components/documents/DocumentsList.tsx`)

## State/providers
- `AppStoreProvider` (`src/state/appStore.tsx`) stores:
  - `profile`, `household`, `role`, `members`, `notifications`.
- `UiProvider` (`src/app/providers.tsx`) stores toasts and `pushToast`.

## Supabase Integration Map

## Supabase client + env
- Client: `src/lib/supabaseClient.ts`
- Required env:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Auth settings:
  - `persistSession: true`
  - `autoRefreshToken: true`
  - `detectSessionInUrl: true`

## UI to table/function mapping
| UI area | Tables read/write | Edge functions |
|---|---|---|
| Bootstrap | `profiles`, `household_members`, `households` | `create-household` |
| Auth invite accept | `invites`, `household_members`, `profiles` | `accept-invite` |
| Schedule | `shifts`, `time_entries`, `feed_items` | none |
| Shift detail | `shifts` | none |
| Feed list/composer | `feed_items`, `attachments` | `upsert-coverage-brief`, `pin-feed-item`, `unpin-feed-item` |
| Feed detail | `feed_items`, `comments`, `acknowledgements`, `read_receipts`, `attachments` | none |
| PTO | `pto_requests`, `feed_items` | none |
| Settings members | `household_members`, `profiles`, `households` | `invite-member`, `change-role` |
| Settings docs | `documents`, `storage.objects` (`household-documents`) | none |
| DM scaffold | `dm_threads`, `dm_thread_participants`, `dm_messages`, `households` | `create-dm-thread` |

## Edge function contracts (implemented)
- `create-household({ household_name, timezone })`
- `invite-member({ household_id, email, role })`
- `accept-invite({ token })`
- `change-role({ household_id, target_user_id, new_role })`
- `pin-feed-item({ household_id, feed_item_id })`
- `unpin-feed-item({ household_id, feed_item_id })`
- `upsert-coverage-brief({ household_id, title, body, is_critical })`
- `create-dm-thread({ household_id, context_type, context_id, participants })`

All current edge functions:
- Handle CORS preflight (`OPTIONS`) with 200.
- Validate bearer JWT via anon client (`getAuthContext`).
- Use service-role client for privileged writes.

## RLS expectations and practical behavior
From migrations `0001_init.sql` and `0002_rls.sql`:
- Household-scoped read access is broadly enforced via membership checks.
- Household creation via direct SQL insert is blocked (`households_insert_authenticated` with `with check (false)`), so `create-household` edge function is required.
- Admin writes are enforced for key tables (`households`, `household_members`, docs writes).

Important implementation notes (current state):
- UI has fine-grained toggle gating via `PermissionHelper` for care updates/comments/acks/docs/DM.
- RLS in `0002_rls.sql` currently does not enforce every admin toggle in SQL for feed comments/acks/care-update writes.
- This means backend enforcement relies partly on edge function flows and UI gating today, not fully on toggle-aware RLS for all actions.

## Common error cases and UI response
- 401 Unauthorized
  - Triggers:
    - Missing/invalid session token.
    - Edge function invoke without bearer token.
  - UI behavior:
    - Caught calls show toast with raw error message.
    - Bootstrap/auth flows may redirect to `/auth` if no session/user.
- 403 Forbidden
  - Triggers:
    - Role check failure in edge function (`Admin access required`, owner-only role operations, DMs disabled).
    - RLS deny on direct table writes.
  - UI behavior:
    - Usually toast with backend error text.
- 409 Conflict
  - Triggers:
    - invite already accepted, unpin coverage brief, last-owner protection.
  - UI behavior: toast.
- 410 Gone
  - Triggers: expired invite token.
  - UI behavior: toast from accept invite path.
- 429 Too Many Requests
  - Potential trigger: auth provider rate limiting.
  - UI behavior: toast if surfaced by API client.
- 500 Internal Server Error
  - Triggers: server/SQL errors in edge functions or malformed joins.
  - UI behavior: toast for caught paths.
  - Note: some submit handlers currently do not wrap all async calls in try/catch, so certain failures can surface as console errors instead of toast.

## Modal/Drawer Behavior Summary
- `Modal` shared component:
  - open trigger: parent decides.
  - close trigger: backdrop click invokes `onClose`.
  - keyboard `Escape`: not implemented.
  - background click: closes.
  - scroll: modal body scrolls (`max-height: 85vh; overflow: auto`).
- Current page-level detail views are route-based panels, not modal instances.
- `SeenByDrawer` is a card section; no animated drawer mechanics implemented.

## UI Debug + QA Attributes
- Debug helper: `src/dev/uiDebug.ts`.
- Badge CSS and anchor behavior: `src/styles/components.css` (`.ui-debug-badge`, `[data-ui]`).
- Major wrappers/modules now include stable `data-ui` anchors in:
  - `AppShell`, `BottomTabs`, all route pages, feed/document modules, toast host, modal component.

## Known Gaps / TODOs (actual current code)
1. `Modal` exists but is not currently used by route pages.
2. Feed detail is implemented as a full route page (`/app/feed/:id`), not a true slide drawer/modal.
3. Attachment viewer is external-tab link; no in-app viewer modal.
4. No explicit loading skeleton/spinner on most pages (`Schedule`, `Feed`, `PTO`, `Settings`, `DM`).
5. Some submit paths do not wrap async operations in `try/catch` (possible uncaught promise errors).
6. Notification center UI is not surfaced even though `notifications` types/state exist.
7. RLS toggle-level enforcement is partial; UI gating is stronger than SQL-level toggle enforcement in some paths.
8. DM scaffold currently allows thread creation and plain messaging but has no participant management UI beyond thread creation payload.
9. Retention cleanup jobs are not implemented; settings/tables store policy only.


-- 0002_rls.sql
-- Row Level Security + helper functions + baseline policies for Cuvver
-- NOTE: This file must be SQL only. Do not place JS/TS/React code here.

-- Helper: current user id
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

-- Helper: is a member of a household
create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = auth.uid()
  );
$$;

-- Helper: is admin (owner/editor/guardian)
-- Supports either enum vocabulary. If you later migrate to owner/editor, keep this.
create or replace function public.is_household_admin(p_household_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = auth.uid()
      and hm.role::text in ('owner','editor','guardian')
  );
$$;

-- Helper: can caregiver comment (household toggle)
create or replace function public.household_toggle(p_household_id uuid, p_key text, p_default boolean)
returns boolean
language sql
stable
as $$
  select coalesce((h.admin_controls ->> p_key)::boolean, p_default)
  from public.households h
  where h.id = p_household_id;
$$;

-- =====================
-- Enable RLS
-- =====================

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- Optional tables (enable if they exist)
-- Using DO blocks so migration is resilient if some tables are added later.

do $$ begin
  execute 'alter table public.invites enable row level security';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'alter table public.shifts enable row level security';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'alter table public.pto_requests enable row level security';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'alter table public.time_entries enable row level security';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'alter table public.feed_items enable row level security';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'alter table public.attachments enable row level security';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'alter table public.comments enable row level security';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'alter table public.acknowledgements enable row level security';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'alter table public.read_receipts enable row level security';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'alter table public.notifications enable row level security';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'alter table public.documents enable row level security';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'alter table public.dm_threads enable row level security';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'alter table public.dm_messages enable row level security';
exception when undefined_table then null; end $$;

-- =====================
-- Profiles
-- =====================

drop policy if exists "profiles_read_own" on public.profiles;
drop policy if exists "profiles_upsert_own" on public.profiles;

create policy "profiles_read_own"
on public.profiles
for select
using (id = auth.uid());

create policy "profiles_upsert_own"
on public.profiles
for insert
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

-- =====================
-- Households
-- =====================

drop policy if exists "households_read_member" on public.households;
drop policy if exists "households_insert_authenticated" on public.households;
drop policy if exists "households_update_admin" on public.households;

create policy "households_read_member"
on public.households
for select
using (public.is_household_member(id));

-- Allow household creation only via service role / edge function typically.
-- This policy keeps client inserts blocked by default.
-- If you do want client inserts during MVP, change 'false' to 'auth.uid() is not null'.
create policy "households_insert_authenticated"
on public.households
for insert
with check (false);

create policy "households_update_admin"
on public.households
for update
using (public.is_household_admin(id))
with check (public.is_household_admin(id));

-- =====================
-- Household Members
-- =====================

drop policy if exists "household_members_read_member" on public.household_members;
drop policy if exists "household_members_insert_admin" on public.household_members;
drop policy if exists "household_members_update_admin" on public.household_members;
drop policy if exists "household_members_delete_admin" on public.household_members;

create policy "household_members_read_member"
on public.household_members
for select
using (public.is_household_member(household_id));

create policy "household_members_insert_admin"
on public.household_members
for insert
with check (public.is_household_admin(household_id));

create policy "household_members_update_admin"
on public.household_members
for update
using (public.is_household_admin(household_id))
with check (public.is_household_admin(household_id));

create policy "household_members_delete_admin"
on public.household_members
for delete
using (public.is_household_admin(household_id));

-- =====================
-- Shifts
-- =====================

do $$ begin
  execute 'drop policy if exists "shifts_read_member" on public.shifts';
  execute 'drop policy if exists "shifts_write_admin" on public.shifts';

  execute $policy$
    create policy "shifts_read_member"
    on public.shifts
    for select
    using (public.is_household_member(household_id));
  $policy$;

  execute $policy$
    create policy "shifts_write_admin"
    on public.shifts
    for all
    using (public.is_household_admin(household_id))
    with check (public.is_household_admin(household_id));
  $policy$;
exception when undefined_table then null; end $$;

-- =====================
-- PTO Requests
-- =====================

do $$ begin
  execute 'drop policy if exists "pto_read_member" on public.pto_requests';
  execute 'drop policy if exists "pto_insert_self" on public.pto_requests';
  execute 'drop policy if exists "pto_update_admin" on public.pto_requests';

  execute $policy$
    create policy "pto_read_member"
    on public.pto_requests
    for select
    using (public.is_household_member(household_id));
  $policy$;

  execute $policy$
    create policy "pto_insert_self"
    on public.pto_requests
    for insert
    with check (auth.uid() = user_id and public.is_household_member(household_id));
  $policy$;

  execute $policy$
    create policy "pto_update_admin"
    on public.pto_requests
    for update
    using (public.is_household_admin(household_id))
    with check (public.is_household_admin(household_id));
  $policy$;
exception when undefined_table then null; end $$;

-- =====================
-- Feed Items
-- =====================

do $$ begin
  execute 'drop policy if exists "feed_read_member" on public.feed_items';
  execute 'drop policy if exists "feed_insert_member" on public.feed_items';
  execute 'drop policy if exists "feed_update_admin" on public.feed_items';

  execute $policy$
    create policy "feed_read_member"
    on public.feed_items
    for select
    using (public.is_household_member(household_id));
  $policy$;

  -- Members can insert care updates/system events; admin should insert system events via functions.
  execute $policy$
    create policy "feed_insert_member"
    on public.feed_items
    for insert
    with check (
      public.is_household_member(household_id)
      and author_user_id = auth.uid()
    );
  $policy$;

  execute $policy$
    create policy "feed_update_admin"
    on public.feed_items
    for update
    using (public.is_household_admin(household_id))
    with check (public.is_household_admin(household_id));
  $policy$;
exception when undefined_table then null; end $$;

-- =====================
-- Comments
-- =====================

do $$ begin
  execute 'drop policy if exists "comments_read_member" on public.comments';
  execute 'drop policy if exists "comments_insert_member" on public.comments';

  execute $policy$
    create policy "comments_read_member"
    on public.comments
    for select
    using (
      exists (
        select 1
        from public.feed_items fi
        where fi.id = comments.feed_item_id
          and public.is_household_member(fi.household_id)
      )
    );
  $policy$;

  execute $policy$
    create policy "comments_insert_member"
    on public.comments
    for insert
    with check (
      author_user_id = auth.uid()
      and exists (
        select 1
        from public.feed_items fi
        where fi.id = comments.feed_item_id
          and public.is_household_member(fi.household_id)
      )
    );
  $policy$;
exception when undefined_table then null; end $$;

-- =====================
-- Acknowledgements + Read Receipts
-- =====================

do $$ begin
  execute 'drop policy if exists "acks_read_member" on public.acknowledgements';
  execute 'drop policy if exists "acks_insert_member" on public.acknowledgements';

  execute $policy$
    create policy "acks_read_member"
    on public.acknowledgements
    for select
    using (
      exists (
        select 1
        from public.feed_items fi
        where fi.id = acknowledgements.feed_item_id
          and public.is_household_member(fi.household_id)
      )
    );
  $policy$;

  execute $policy$
    create policy "acks_insert_member"
    on public.acknowledgements
    for insert
    with check (
      author_user_id = auth.uid()
      and exists (
        select 1
        from public.feed_items fi
        where fi.id = acknowledgements.feed_item_id
          and public.is_household_member(fi.household_id)
      )
    );
  $policy$;
exception when undefined_table then null; end $$;


do $$ begin
  execute 'drop policy if exists "reads_read_member" on public.read_receipts';
  execute 'drop policy if exists "reads_upsert_member" on public.read_receipts';

  execute $policy$
    create policy "reads_read_member"
    on public.read_receipts
    for select
    using (
      exists (
        select 1
        from public.feed_items fi
        where fi.id = read_receipts.feed_item_id
          and public.is_household_member(fi.household_id)
      )
    );
  $policy$;

  execute $policy$
    create policy "reads_upsert_member"
    on public.read_receipts
    for insert
    with check (
      user_id = auth.uid()
      and exists (
        select 1
        from public.feed_items fi
        where fi.id = read_receipts.feed_item_id
          and public.is_household_member(fi.household_id)
      )
    );
  $policy$;
exception when undefined_table then null; end $$;

-- =====================
-- Documents
-- =====================

do $$ begin
  execute 'drop policy if exists "docs_read_member" on public.documents';
  execute 'drop policy if exists "docs_write_admin" on public.documents';

  execute $policy$
    create policy "docs_read_member"
    on public.documents
    for select
    using (public.is_household_member(household_id));
  $policy$;

  execute $policy$
    create policy "docs_write_admin"
    on public.documents
    for all
    using (public.is_household_admin(household_id))
    with check (public.is_household_admin(household_id));
  $policy$;
exception when undefined_table then null; end $$;

-- =====================
-- DMs (scaffold)
-- =====================

do $$ begin
  execute 'drop policy if exists "dm_threads_read_member" on public.dm_threads';
  execute 'drop policy if exists "dm_threads_write_member" on public.dm_threads';

  execute $policy$
    create policy "dm_threads_read_member"
    on public.dm_threads
    for select
    using (public.is_household_member(household_id));
  $policy$;

  execute $policy$
    create policy "dm_threads_write_member"
    on public.dm_threads
    for insert
    with check (
      public.is_household_member(household_id)
      and created_by_user_id = auth.uid()
    );
  $policy$;
exception when undefined_table then null; end $$;


do $$ begin
  execute 'drop policy if exists "dm_messages_read_member" on public.dm_messages';
  execute 'drop policy if exists "dm_messages_write_member" on public.dm_messages';

  execute $policy$
    create policy "dm_messages_read_member"
    on public.dm_messages
    for select
    using (
      exists (
        select 1
        from public.dm_threads t
        where t.id = dm_messages.thread_id
          and public.is_household_member(t.household_id)
      )
    );
  $policy$;

  execute $policy$
    create policy "dm_messages_write_member"
    on public.dm_messages
    for insert
    with check (
      author_user_id = auth.uid()
      and exists (
        select 1
        from public.dm_threads t
        where t.id = dm_messages.thread_id
          and public.is_household_member(t.household_id)
      )
    );
  $policy$;
exception when undefined_table then null; end $$;

-- End

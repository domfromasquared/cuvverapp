-- 0005_audit_fixes.sql
-- Hosted-safe audit fixes for RLS helpers, missing policies, and storage access.
-- Non-destructive: no table drops, no data deletes.

-- Harden helper functions to avoid policy recursion and ambiguous search_path behavior.
create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid();
$$;

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = auth.uid()
  );
$$;

create or replace function public.member_role(p_household_id uuid)
returns public.household_role
language sql
stable
security definer
set search_path = public
as $$
  select hm.role
  from public.household_members hm
  where hm.household_id = p_household_id
    and hm.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_household_admin(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.member_role(p_household_id) in ('owner', 'editor'), false);
$$;

create or replace function public.household_toggle(p_household_id uuid, p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((h.admin_controls ->> p_key)::boolean, p_default)
  from public.households h
  where h.id = p_household_id;
$$;

create or replace function public.can_comment_in_household(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_household_admin(p_household_id) then true
    when public.member_role(p_household_id) = 'caregiver' then public.household_toggle(p_household_id, 'caregivers_can_comment', true)
    when public.member_role(p_household_id) = 'viewer' then public.household_toggle(p_household_id, 'viewers_can_comment', false)
    else false
  end;
$$;

create or replace function public.can_ack_in_household(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_household_admin(p_household_id) then true
    when public.member_role(p_household_id) = 'caregiver' then true
    when public.member_role(p_household_id) = 'viewer' then public.household_toggle(p_household_id, 'viewers_can_acknowledge', true)
    else false
  end;
$$;

-- Ensure RLS is enabled on missing tables.
do $$ begin
  execute 'alter table public.dependents enable row level security';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'alter table public.time_entries enable row level security';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'alter table public.attachments enable row level security';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'alter table public.notifications enable row level security';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'alter table public.invites enable row level security';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'alter table public.dm_thread_participants enable row level security';
exception when undefined_table then null; end $$;

-- Household members policies (explicitly reasserted with hardened helpers).
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

-- Invites (admin managed).
do $$ begin
  execute 'drop policy if exists "invites_admin_select" on public.invites';
  execute 'drop policy if exists "invites_admin_insert" on public.invites';
  execute 'drop policy if exists "invites_admin_update" on public.invites';
  execute 'drop policy if exists "invites_admin_delete" on public.invites';

  execute '
    create policy "invites_admin_select"
    on public.invites
    for select
    using (public.is_household_admin(household_id))
  ';

  execute '
    create policy "invites_admin_insert"
    on public.invites
    for insert
    with check (public.is_household_admin(household_id))
  ';

  execute '
    create policy "invites_admin_update"
    on public.invites
    for update
    using (public.is_household_admin(household_id))
    with check (public.is_household_admin(household_id))
  ';

  execute '
    create policy "invites_admin_delete"
    on public.invites
    for delete
    using (public.is_household_admin(household_id))
  ';
exception when undefined_table then null; end $$;

-- Dependents.
do $$ begin
  execute 'drop policy if exists "dependents_read_member" on public.dependents';
  execute 'drop policy if exists "dependents_write_admin" on public.dependents';

  execute '
    create policy "dependents_read_member"
    on public.dependents
    for select
    using (public.is_household_member(household_id))
  ';

  execute '
    create policy "dependents_write_admin"
    on public.dependents
    for all
    using (public.is_household_admin(household_id))
    with check (public.is_household_admin(household_id))
  ';
exception when undefined_table then null; end $$;

-- Time entries.
do $$ begin
  execute 'drop policy if exists "time_entries_read_member" on public.time_entries';
  execute 'drop policy if exists "time_entries_insert_member" on public.time_entries';
  execute 'drop policy if exists "time_entries_update_self_or_admin" on public.time_entries';
  execute 'drop policy if exists "time_entries_delete_admin" on public.time_entries';

  execute '
    create policy "time_entries_read_member"
    on public.time_entries
    for select
    using (public.is_household_member(household_id))
  ';

  execute '
    create policy "time_entries_insert_member"
    on public.time_entries
    for insert
    with check (
      user_id = auth.uid()
      and public.is_household_member(household_id)
    )
  ';

  execute '
    create policy "time_entries_update_self_or_admin"
    on public.time_entries
    for update
    using (public.is_household_admin(household_id) or user_id = auth.uid())
    with check (public.is_household_admin(household_id) or user_id = auth.uid())
  ';

  execute '
    create policy "time_entries_delete_admin"
    on public.time_entries
    for delete
    using (public.is_household_admin(household_id))
  ';
exception when undefined_table then null; end $$;

-- Attachments.
do $$ begin
  execute 'drop policy if exists "attachments_read_member" on public.attachments';
  execute 'drop policy if exists "attachments_insert_policy" on public.attachments';
  execute 'drop policy if exists "attachments_delete_admin" on public.attachments';

  execute '
    create policy "attachments_read_member"
    on public.attachments
    for select
    using (public.is_household_member(household_id))
  ';

  execute '
    create policy "attachments_insert_policy"
    on public.attachments
    for insert
    with check (
      public.is_household_member(household_id)
      and exists (
        select 1
        from public.feed_items fi
        where fi.id = attachments.feed_item_id
          and fi.household_id = attachments.household_id
      )
      and (
        public.is_household_admin(household_id)
        or (
          public.member_role(household_id) = ''caregiver''
          and public.household_toggle(household_id, ''caregivers_can_upload_attachments'', true)
        )
      )
    )
  ';

  execute '
    create policy "attachments_delete_admin"
    on public.attachments
    for delete
    using (public.is_household_admin(household_id))
  ';
exception when undefined_table then null; end $$;

-- Notifications.
do $$ begin
  execute 'drop policy if exists "notifications_select_own" on public.notifications';
  execute 'drop policy if exists "notifications_insert_admin" on public.notifications';
  execute 'drop policy if exists "notifications_update_own" on public.notifications';

  execute '
    create policy "notifications_select_own"
    on public.notifications
    for select
    using (user_id = auth.uid() and public.is_household_member(household_id))
  ';

  execute '
    create policy "notifications_insert_admin"
    on public.notifications
    for insert
    with check (public.is_household_admin(household_id))
  ';

  execute '
    create policy "notifications_update_own"
    on public.notifications
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid())
  ';
exception when undefined_table then null; end $$;

-- Comments + acknowledgements (toggle-aware).
do $$ begin
  execute 'drop policy if exists "comments_insert_member" on public.comments';

  execute '
    create policy "comments_insert_member"
    on public.comments
    for insert
    with check (
      author_user_id = auth.uid()
      and public.can_comment_in_household(household_id)
      and exists (
        select 1
        from public.feed_items fi
        where fi.id = comments.feed_item_id
          and fi.household_id = comments.household_id
      )
    )
  ';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'drop policy if exists "acks_insert_member" on public.acknowledgements';

  execute '
    create policy "acks_insert_member"
    on public.acknowledgements
    for insert
    with check (
      author_user_id = auth.uid()
      and public.can_ack_in_household(household_id)
      and exists (
        select 1
        from public.feed_items fi
        where fi.id = acknowledgements.feed_item_id
          and fi.household_id = acknowledgements.household_id
      )
    )
  ';
exception when undefined_table then null; end $$;

-- Documents: owner/editor write, owner/editor/caregiver read.
do $$ begin
  execute 'drop policy if exists "docs_read_member" on public.documents';
  execute 'drop policy if exists "docs_write_admin" on public.documents';
  execute 'drop policy if exists "docs_select_role" on public.documents';
  execute 'drop policy if exists "docs_insert_admin" on public.documents';
  execute 'drop policy if exists "docs_update_admin" on public.documents';
  execute 'drop policy if exists "docs_delete_admin" on public.documents';

  execute '
    create policy "docs_select_role"
    on public.documents
    for select
    using (public.member_role(household_id) in (''owner'', ''editor'', ''caregiver''))
  ';

  execute '
    create policy "docs_insert_admin"
    on public.documents
    for insert
    with check (public.is_household_admin(household_id))
  ';

  execute '
    create policy "docs_update_admin"
    on public.documents
    for update
    using (public.is_household_admin(household_id))
    with check (public.is_household_admin(household_id))
  ';

  execute '
    create policy "docs_delete_admin"
    on public.documents
    for delete
    using (public.is_household_admin(household_id))
  ';
exception when undefined_table then null; end $$;

-- DM participants and DM thread insert gating.
do $$ begin
  execute 'drop policy if exists "dm_participants_select_member" on public.dm_thread_participants';
  execute 'drop policy if exists "dm_participants_insert_member" on public.dm_thread_participants';

  execute '
    create policy "dm_participants_select_member"
    on public.dm_thread_participants
    for select
    using (
      exists (
        select 1
        from public.dm_threads t
        where t.id = dm_thread_participants.thread_id
          and public.is_household_member(t.household_id)
      )
    )
  ';

  execute '
    create policy "dm_participants_insert_member"
    on public.dm_thread_participants
    for insert
    with check (
      exists (
        select 1
        from public.dm_threads t
        where t.id = dm_thread_participants.thread_id
          and public.is_household_member(t.household_id)
      )
    )
  ';
exception when undefined_table then null; end $$;

do $$ begin
  execute 'drop policy if exists "dm_threads_write_member" on public.dm_threads';
  execute '
    create policy "dm_threads_write_member"
    on public.dm_threads
    for insert
    with check (
      public.is_household_member(household_id)
      and created_by_user_id = auth.uid()
      and public.household_toggle(household_id, ''dms_enabled'', false)
    )
  ';
exception when undefined_table then null; end $$;

-- Storage policies are created best-effort. Hosted SQL editor can lack storage.objects ownership.
do $$
begin
  begin
    execute 'alter table storage.objects enable row level security';

    execute 'drop policy if exists care_updates_select on storage.objects';
    execute 'drop policy if exists care_updates_insert on storage.objects';
    execute 'drop policy if exists care_updates_delete on storage.objects';
    execute 'drop policy if exists docs_select on storage.objects';
    execute 'drop policy if exists docs_insert on storage.objects';
    execute 'drop policy if exists docs_delete on storage.objects';

    execute '
      create policy care_updates_select
      on storage.objects
      for select
      using (
        bucket_id = ''care-updates''
        and public.is_household_member((storage.foldername(name))[1]::uuid)
      )
    ';

    execute '
      create policy care_updates_insert
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = ''care-updates''
        and public.is_household_member((storage.foldername(name))[1]::uuid)
        and (
          public.is_household_admin((storage.foldername(name))[1]::uuid)
          or (
            public.member_role((storage.foldername(name))[1]::uuid) = ''caregiver''
            and public.household_toggle((storage.foldername(name))[1]::uuid, ''caregivers_can_upload_attachments'', true)
          )
        )
      )
    ';

    execute '
      create policy care_updates_delete
      on storage.objects
      for delete
      using (
        bucket_id = ''care-updates''
        and public.is_household_admin((storage.foldername(name))[1]::uuid)
      )
    ';

    execute '
      create policy docs_select
      on storage.objects
      for select
      using (
        bucket_id = ''household-documents''
        and public.member_role((storage.foldername(name))[1]::uuid) in (''owner'', ''editor'', ''caregiver'')
      )
    ';

    execute '
      create policy docs_insert
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = ''household-documents''
        and public.is_household_admin((storage.foldername(name))[1]::uuid)
      )
    ';

    execute '
      create policy docs_delete
      on storage.objects
      for delete
      using (
        bucket_id = ''household-documents''
        and public.is_household_admin((storage.foldername(name))[1]::uuid)
      )
    ';
  exception
    when insufficient_privilege then
      raise notice 'Skipping storage.objects policy changes due missing ownership privileges in this execution context.';
  end;
end
$$;


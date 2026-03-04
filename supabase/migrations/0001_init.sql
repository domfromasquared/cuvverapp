create extension if not exists pgcrypto;

create type public.household_role as enum ('owner', 'editor', 'caregiver', 'viewer');
create type public.feed_item_type as enum ('system_event', 'care_update', 'coverage_brief', 'protocol');
create type public.pto_status as enum ('pending', 'approved', 'denied');
create type public.pto_type as enum ('vacation', 'sick', 'personal', 'other');
create type public.ack_kind as enum ('seen', 'thanks', 'love', 'got_it');
create type public.time_entry_status as enum ('open', 'submitted', 'approved', 'rejected');
create type public.attachment_type as enum ('photo', 'video', 'document');
create type public.dependent_type as enum ('child', 'senior', 'other');
create type public.dm_context_type as enum ('shift', 'pto', 'feed_item');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid,
  display_name text not null default '',
  email text not null unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/Los_Angeles',
  quiet_hours_start time,
  quiet_hours_end time,
  retention_policy_days integer not null default 60 check (retention_policy_days in (30, 60, 90)),
  notify_care_updates boolean not null default true,
  notify_schedule_changes boolean not null default true,
  notify_pto_changes boolean not null default true,
  admin_controls jsonb not null default jsonb_build_object(
    'caregivers_can_post_care_updates', true,
    'caregivers_can_upload_attachments', true,
    'caregivers_can_comment', true,
    'viewers_can_acknowledge', true,
    'viewers_can_comment', false,
    'require_ack_for_critical', true,
    'dms_enabled', false
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_households_updated_at
before update on public.households
for each row execute function public.set_updated_at();

alter table public.profiles
  add constraint profiles_household_fkey
  foreign key (household_id) references public.households(id) on delete set null;

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.household_role not null,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null,
  role public.household_role not null,
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.dependents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  display_name text not null,
  type public.dependent_type not null default 'child',
  birthdate date,
  created_at timestamptz not null default now()
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  caregiver_user_id uuid references public.profiles(id) on delete set null,
  title text not null,
  start_datetime timestamptz not null,
  end_datetime timestamptz not null,
  recurrence_rule text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_datetime > start_datetime)
);

create trigger trg_shifts_updated_at
before update on public.shifts
for each row execute function public.set_updated_at();

create table public.pto_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  type public.pto_type not null,
  note text,
  status public.pto_status not null default 'pending',
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  clock_in timestamptz not null,
  clock_out timestamptz,
  status public.time_entry_status not null default 'open',
  created_at timestamptz not null default now()
);

create table public.feed_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  type public.feed_item_type not null,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  is_pinned boolean not null default false,
  is_critical boolean not null default false,
  shift_id uuid references public.shifts(id) on delete set null,
  pto_request_id uuid references public.pto_requests(id) on delete set null,
  template_tag text,
  created_at timestamptz not null default now()
);

create unique index uq_coverage_brief_per_household
on public.feed_items (household_id)
where type = 'coverage_brief';

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  feed_item_id uuid not null references public.feed_items(id) on delete cascade,
  type public.attachment_type not null,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  feed_item_id uuid not null references public.feed_items(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.acknowledgements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  feed_item_id uuid not null references public.feed_items(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  kind public.ack_kind not null,
  created_at timestamptz not null default now(),
  unique (feed_item_id, author_user_id, kind)
);

create table public.read_receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  feed_item_id uuid not null references public.feed_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  seen_at timestamptz not null default now(),
  unique (feed_item_id, user_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  dependent_id uuid references public.dependents(id) on delete set null,
  title text not null,
  category text,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_path text not null,
  uploaded_by_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  context_type public.dm_context_type not null,
  context_id uuid not null,
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null references public.profiles(id) on delete cascade
);

create table public.dm_thread_participants (
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_members_user on public.household_members(user_id);
create index idx_shifts_household_start on public.shifts(household_id, start_datetime);
create index idx_pto_household_created on public.pto_requests(household_id, created_at desc);
create index idx_feed_household_created on public.feed_items(household_id, created_at desc);
create index idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index idx_docs_household_created on public.documents(household_id, created_at desc);
create index idx_dm_threads_context on public.dm_threads(household_id, context_type, context_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into storage.buckets (id, name, public)
values ('care-updates', 'care-updates', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('household-documents', 'household-documents', false)
on conflict (id) do nothing;

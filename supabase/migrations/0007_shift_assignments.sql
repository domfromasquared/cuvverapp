-- 0007_shift_assignments.sql
-- Adds shift assignment acknowledgment workflow.
-- Non-destructive. Backfills existing shifts as auto-accepted.

create type public.assignment_status as enum (
  'pending',    -- caregiver hasn't responded yet
  'accepted',   -- caregiver confirmed the shift
  'declined',   -- caregiver rejected the shift
  'changed',    -- admin edited shift after acceptance; needs re-confirm
  'cancelled'   -- admin cancelled the assignment
);

create table public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  caregiver_user_id uuid not null references public.profiles(id) on delete cascade,
  status public.assignment_status not null default 'pending',
  assigned_by_user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  responded_at timestamptz,
  response_note text,
  -- Snapshot of the shift at assignment time, so we can detect edits.
  snapshot_start timestamptz not null,
  snapshot_end timestamptz not null,
  snapshot_title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_id, caregiver_user_id)
);

create trigger trg_shift_assignments_updated_at
before update on public.shift_assignments
for each row execute function public.set_updated_at();

create index idx_shift_assignments_caregiver_status
  on public.shift_assignments(caregiver_user_id, status);
create index idx_shift_assignments_household_status
  on public.shift_assignments(household_id, status);

alter table public.shift_assignments enable row level security;

create policy "assignments_read_member"
  on public.shift_assignments
  for select
  using (public.is_household_member(household_id));

create policy "assignments_insert_admin"
  on public.shift_assignments
  for insert
  with check (public.is_household_admin(household_id));

create policy "assignments_delete_admin"
  on public.shift_assignments
  for delete
  using (public.is_household_admin(household_id));

create policy "assignments_update_admin"
  on public.shift_assignments
  for update
  using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id));

-- Caregivers can update only their own row, only to accepted/declined.
create policy "assignments_update_caregiver_own"
  on public.shift_assignments
  for update
  using (
    caregiver_user_id = auth.uid()
    and public.is_household_member(household_id)
  )
  with check (
    caregiver_user_id = auth.uid()
    and status in ('accepted', 'declined')
  );

-- Trigger: when a shift's times or title change, flip 'accepted' assignments
-- back to 'changed' so caregiver re-confirms. Don't touch pending/declined.
create or replace function public.mark_assignments_changed_on_shift_edit()
returns trigger
language plpgsql
as $$
begin
  if (
    new.start_datetime is distinct from old.start_datetime
    or new.end_datetime is distinct from old.end_datetime
    or new.title is distinct from old.title
  ) then
    update public.shift_assignments
       set status = 'changed',
           snapshot_start = new.start_datetime,
           snapshot_end = new.end_datetime,
           snapshot_title = new.title
     where shift_id = new.id
       and status = 'accepted';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_shift_edit_invalidates_assignment on public.shifts;
create trigger trg_shift_edit_invalidates_assignment
after update on public.shifts
for each row execute function public.mark_assignments_changed_on_shift_edit();

-- Backfill: existing shifts with caregiver_user_id become auto-accepted
-- so seeded data doesn't suddenly show as pending.
insert into public.shift_assignments (
  household_id, shift_id, caregiver_user_id, status,
  assigned_by_user_id, assigned_at, responded_at,
  snapshot_start, snapshot_end, snapshot_title
)
select
  s.household_id, s.id, s.caregiver_user_id, 'accepted',
  s.caregiver_user_id, s.created_at, s.created_at,
  s.start_datetime, s.end_datetime, s.title
from public.shifts s
where s.caregiver_user_id is not null
on conflict (shift_id, caregiver_user_id) do nothing;

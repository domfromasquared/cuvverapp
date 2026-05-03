-- 0006_profile_avatars.sql
-- Profile avatar support with same-household profile visibility and storage policies.

alter table public.profiles
  add column if not exists avatar_path text;

create or replace function public.can_read_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_profile_id = auth.uid()
    or exists (
      select 1
      from public.household_members me
      join public.household_members them on them.household_id = me.household_id
      where me.user_id = auth.uid()
        and them.user_id = p_profile_id
    );
$$;

drop policy if exists "profiles_read_own" on public.profiles;
drop policy if exists "profiles_read_same_household" on public.profiles;

create policy "profiles_read_same_household"
on public.profiles
for select
using (public.can_read_profile(id));

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', false)
on conflict (id) do nothing;

do $$
begin
  begin
    execute 'alter table storage.objects enable row level security';

    execute 'drop policy if exists profile_avatars_select on storage.objects';
    execute 'drop policy if exists profile_avatars_insert on storage.objects';
    execute 'drop policy if exists profile_avatars_delete on storage.objects';

    execute '
      create policy profile_avatars_select
      on storage.objects
      for select
      using (
        bucket_id = ''profile-avatars''
        and public.is_household_member((storage.foldername(name))[1]::uuid)
      )
    ';

    execute '
      create policy profile_avatars_insert
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = ''profile-avatars''
        and public.is_household_member((storage.foldername(name))[1]::uuid)
        and (storage.foldername(name))[2]::uuid = auth.uid()
      )
    ';

    execute '
      create policy profile_avatars_delete
      on storage.objects
      for delete
      using (
        bucket_id = ''profile-avatars''
        and public.is_household_member((storage.foldername(name))[1]::uuid)
        and (storage.foldername(name))[2]::uuid = auth.uid()
      )
    ';
  exception
    when others then
      raise notice 'Skipping storage.objects avatar policies: %', sqlerrm;
  end;
end $$;

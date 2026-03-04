insert into public.households (
  id,
  name,
  timezone,
  quiet_hours_start,
  quiet_hours_end,
  retention_policy_days,
  notify_care_updates,
  notify_schedule_changes,
  notify_pto_changes
)
values (
  '11111111-1111-1111-1111-111111111111',
  'Hartley Household',
  'America/Los_Angeles',
  '21:00',
  '06:30',
  60,
  true,
  true,
  true
)
on conflict (id) do update
set name = excluded.name;

-- Profiles and memberships depend on auth.users records.
do $$
declare
  owner_id uuid;
  caregiver_id uuid;
begin
  select id into owner_id from auth.users where email = 'owner@hartley.test' limit 1;
  select id into caregiver_id from auth.users where email = 'caregiver@hartley.test' limit 1;

  if owner_id is not null then
    insert into public.profiles (id, household_id, display_name, email)
    values (owner_id, '11111111-1111-1111-1111-111111111111', 'Emma Hartley', 'owner@hartley.test')
    on conflict (id) do update set household_id = excluded.household_id, display_name = excluded.display_name;

    insert into public.household_members (household_id, user_id, role)
    values ('11111111-1111-1111-1111-111111111111', owner_id, 'owner')
    on conflict (household_id, user_id) do update set role = excluded.role;

    -- Seed owner-authored content only when owner user exists in auth.users
    insert into public.feed_items (
      id,
      household_id,
      type,
      author_user_id,
      title,
      body,
      is_pinned,
      is_critical,
      template_tag
    )
    values (
      '33333333-3333-3333-3333-333333333331',
      '11111111-1111-1111-1111-111111111111',
      'coverage_brief',
      owner_id,
      'Coverage Brief',
      'Emergency: Emma 555-1000, Liam 555-2000. Pickup: north gate. House rules: no peanuts indoors.',
      true,
      true,
      'Coverage'
    )
    on conflict do nothing;

    insert into public.feed_items (
      id,
      household_id,
      type,
      author_user_id,
      title,
      body,
      is_pinned,
      is_critical,
      template_tag
    )
    values (
      '33333333-3333-3333-3333-333333333332',
      '11111111-1111-1111-1111-111111111111',
      'protocol',
      owner_id,
      'School Pickup Protocol',
      'Bring ID, text on pickup, confirm handoff by 3:20 PM.',
      true,
      true,
      'Protocol'
    )
    on conflict do nothing;

    insert into public.documents (
      id,
      household_id,
      title,
      category,
      file_name,
      mime_type,
      size_bytes,
      storage_path,
      uploaded_by_user_id
    )
    values (
      '44444444-4444-4444-4444-444444444441',
      '11111111-1111-1111-1111-111111111111',
      'School Contact Sheet',
      'General',
      'school-contact-sheet.pdf',
      'application/pdf',
      40960,
      '11111111-1111-1111-1111-111111111111/school-contact-sheet.pdf',
      owner_id
    )
    on conflict do nothing;
  else
    raise notice 'Seed: owner@hartley.test not found in auth.users';
  end if;

  if caregiver_id is not null then
    insert into public.profiles (id, household_id, display_name, email)
    values (caregiver_id, '11111111-1111-1111-1111-111111111111', 'Jordan Care', 'caregiver@hartley.test')
    on conflict (id) do update set household_id = excluded.household_id, display_name = excluded.display_name;

    insert into public.household_members (household_id, user_id, role)
    values ('11111111-1111-1111-1111-111111111111', caregiver_id, 'caregiver')
    on conflict (household_id, user_id) do update set role = excluded.role;

    -- Seed caregiver-authored content only when caregiver user exists in auth.users
    insert into public.shifts (
      id,
      household_id,
      caregiver_user_id,
      title,
      start_datetime,
      end_datetime,
      recurrence_rule,
      notes
    )
    values (
      '22222222-2222-2222-2222-222222222222',
      '11111111-1111-1111-1111-111111111111',
      caregiver_id,
      'Weekday Afternoon Coverage',
      now() + interval '1 day' + interval '15 hours',
      now() + interval '1 day' + interval '19 hours',
      'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
      'School pickup and evening handoff.'
    )
    on conflict (id) do nothing;

    insert into public.feed_items (
      id,
      household_id,
      type,
      author_user_id,
      title,
      body,
      is_pinned,
      is_critical,
      template_tag,
      shift_id
    )
    values (
      '33333333-3333-3333-3333-333333333333',
      '11111111-1111-1111-1111-111111111111',
      'care_update',
      caregiver_id,
      'After-school update',
      'Homework complete and snack finished before park walk.',
      false,
      false,
      'Homework',
      '22222222-2222-2222-2222-222222222222'
    )
    on conflict do nothing;

    insert into public.pto_requests (
      id,
      household_id,
      user_id,
      start_date,
      end_date,
      type,
      note,
      status
    )
    values (
      '55555555-5555-5555-5555-555555555551',
      '11111111-1111-1111-1111-111111111111',
      caregiver_id,
      current_date + 10,
      current_date + 11,
      'personal',
      'Family obligation.',
      'pending'
    )
    on conflict do nothing;

    insert into public.time_entries (
      id,
      household_id,
      shift_id,
      user_id,
      clock_in,
      clock_out,
      status
    )
    values (
      '66666666-6666-6666-6666-666666666661',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      caregiver_id,
      now() - interval '3 hour',
      now() - interval '1 hour',
      'submitted'
    )
    on conflict do nothing;
  else
    raise notice 'Seed: caregiver@hartley.test not found in auth.users';
  end if;
end;
$$;

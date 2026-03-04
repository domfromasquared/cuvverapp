create or replace view public.v_feed_enriched as
select
  f.*, 
  p.display_name as author_name,
  coalesce(att.attachment_count, 0) as attachment_count,
  coalesce(com.comment_count, 0) as comment_count,
  coalesce(ack.ack_count, 0) as acknowledgement_count
from public.feed_items f
left join public.profiles p on p.id = f.author_user_id
left join (
  select feed_item_id, count(*) as attachment_count
  from public.attachments
  group by feed_item_id
) att on att.feed_item_id = f.id
left join (
  select feed_item_id, count(*) as comment_count
  from public.comments
  group by feed_item_id
) com on com.feed_item_id = f.id
left join (
  select feed_item_id, count(*) as ack_count
  from public.acknowledgements
  group by feed_item_id
) ack on ack.feed_item_id = f.id;

create or replace view public.v_schedule_agenda as
select
  s.*,
  p.display_name as caregiver_name
from public.shifts s
left join public.profiles p on p.id = s.caregiver_user_id;

create or replace view public.v_pto_summary as
select
  pto.*,
  requester.display_name as requester_name,
  decider.display_name as decider_name
from public.pto_requests pto
left join public.profiles requester on requester.id = pto.user_id
left join public.profiles decider on decider.id = pto.decided_by;

create or replace view public.v_documents_visible as
select
  d.*,
  p.display_name as uploaded_by_name
from public.documents d
left join public.profiles p on p.id = d.uploaded_by_user_id;

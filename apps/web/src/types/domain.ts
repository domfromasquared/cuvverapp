export type Role = "owner" | "editor" | "caregiver" | "viewer";

export type FeedItemType = "system_event" | "care_update" | "coverage_brief" | "protocol";

export type PtoStatus = "pending" | "approved" | "denied";

export type TimeEntryStatus = "open" | "submitted" | "approved" | "rejected";

export type AttachmentType = "photo" | "video" | "document";

export type AcknowledgementKind = "seen" | "thanks" | "love" | "got_it";

export type DmContextType = "shift" | "pto" | "feed_item";

export interface AdminControls {
  caregivers_can_post_care_updates: boolean;
  caregivers_can_upload_attachments: boolean;
  caregivers_can_comment: boolean;
  viewers_can_acknowledge: boolean;
  viewers_can_comment: boolean;
  require_ack_for_critical: boolean;
  dms_enabled: boolean;
}

export interface UserProfile {
  id: string;
  household_id: string | null;
  display_name: string;
  email: string;
  avatar_url?: string | null;
  avatar_path?: string | null;
  created_at: string;
}

export interface Household {
  id: string;
  name: string;
  timezone: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  retention_policy_days: number;
  notify_care_updates: boolean;
  notify_schedule_changes: boolean;
  notify_pto_changes: boolean;
  admin_controls: AdminControls;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  role: Role;
  display_name?: string;
  email?: string;
  avatar_url?: string | null;
  avatar_path?: string | null;
  created_at: string;
}

export interface Dependent {
  id: string;
  household_id: string;
  display_name: string;
  type: "child" | "senior" | "other";
  birthdate: string | null;
  created_at: string;
}

export interface Shift {
  id: string;
  household_id: string;
  caregiver_user_id: string | null;
  title: string;
  start_datetime: string;
  end_datetime: string;
  recurrence_rule: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PtoRequest {
  id: string;
  household_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  type: "vacation" | "sick" | "personal" | "other";
  note: string | null;
  status: PtoStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  household_id: string;
  shift_id: string | null;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  status: TimeEntryStatus;
  created_at: string;
}

export interface Attachment {
  id: string;
  household_id: string;
  feed_item_id: string;
  type: AttachmentType;
  storage_path: string;
  mime_type: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  household_id: string;
  feed_item_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
}

export interface Acknowledgement {
  id: string;
  household_id: string;
  feed_item_id: string;
  author_user_id: string;
  kind: AcknowledgementKind;
  created_at: string;
}

export interface ReadReceipt {
  id: string;
  household_id: string;
  feed_item_id: string;
  user_id: string;
  seen_at: string;
}

export interface FeedItem {
  id: string;
  household_id: string;
  type: FeedItemType;
  author_user_id: string;
  created_at: string;
  title: string;
  body: string | null;
  is_pinned: boolean;
  is_critical: boolean;
  shift_id: string | null;
  pto_request_id: string | null;
  template_tag: string | null;
}

export interface NotificationItem {
  id: string;
  household_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  household_id: string;
  dependent_id: string | null;
  title: string;
  category: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  uploaded_by_user_id: string;
  created_at: string;
}

export interface DmThread {
  id: string;
  household_id: string;
  context_type: DmContextType;
  context_id: string;
  created_at: string;
  created_by_user_id: string;
}

export interface DmMessage {
  id: string;
  thread_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
}

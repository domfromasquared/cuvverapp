import type { Role, DmContextType } from "./domain";

export interface CreateHouseholdInput {
  household_name: string;
  timezone: string;
}

export interface CreateHouseholdResponse {
  household_id: string;
}

export interface InviteMemberInput {
  household_id: string;
  email: string;
  role: Role;
}

export interface InviteMemberResponse {
  token: string;
  invite_link: string;
}

export interface AcceptInviteInput {
  token: string;
}

export interface ChangeRoleInput {
  household_id: string;
  target_user_id: string;
  new_role: Role;
}

export interface PinFeedItemInput {
  household_id: string;
  feed_item_id: string;
}

export interface UpsertCoverageBriefInput {
  household_id: string;
  title: string;
  body: string;
  is_critical: boolean;
}

export interface CreateDmThreadInput {
  household_id: string;
  context_type: DmContextType;
  context_id: string;
  participants: string[];
}

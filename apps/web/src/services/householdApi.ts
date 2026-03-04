import { supabase } from "../lib/supabaseClient";
import { getAccessToken } from "../auth/session";
import type {
  AcceptInviteInput,
  ChangeRoleInput,
  CreateHouseholdInput,
  CreateHouseholdResponse,
  InviteMemberInput,
  InviteMemberResponse
} from "../types/api";
import type { Household, HouseholdMember, UserProfile } from "../types/domain";

function assertNoError(error: unknown): void {
  if (error) throw error;
}

async function invokeWithAuth<T, TBody extends object = object>(name: string, body: TBody): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${token}` }
  });

  assertNoError(error);
  return data as T;
}

export async function ensureProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      email: user.email ?? "",
      display_name: (user.user_metadata?.display_name as string | undefined) ?? user.email?.split("@")[0] ?? "Member"
    })
    .select("*")
    .single();

  assertNoError(error);
  return data as UserProfile;
}

export async function listMyHouseholds(): Promise<Array<Household & { role: HouseholdMember["role"] }>> {
  const { data, error } = await supabase
    .from("household_members")
    .select(
      "role, households:household_id(id,name,timezone,quiet_hours_start,quiet_hours_end,retention_policy_days,notify_care_updates,notify_schedule_changes,notify_pto_changes,admin_controls,created_at,updated_at)"
    );

  assertNoError(error);
  const rows = (data ?? []) as Array<{ role: HouseholdMember["role"]; households: Household | Household[] | null }>;
  return rows
    .map((row) => {
      const household = Array.isArray(row.households) ? row.households[0] : row.households;
      if (!household) return null;
      return { ...household, role: row.role };
    })
    .filter((row): row is Household & { role: HouseholdMember["role"] } => row !== null);
}

export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const { data, error } = await supabase
    .from("household_members")
    .select("household_id,user_id,role,created_at,profiles:user_id(display_name,email)")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  assertNoError(error);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    household_id: row.household_id as string,
    user_id: row.user_id as string,
    role: row.role as HouseholdMember["role"],
    created_at: row.created_at as string,
    display_name: (row.profiles as { display_name?: string } | null)?.display_name,
    email: (row.profiles as { email?: string } | null)?.email
  }));
}

export async function createHousehold(input: CreateHouseholdInput): Promise<CreateHouseholdResponse> {
  return invokeWithAuth<CreateHouseholdResponse>("create-household", input);
}

export async function inviteMember(input: InviteMemberInput): Promise<InviteMemberResponse> {
  return invokeWithAuth<InviteMemberResponse>("invite-member", input);
}

export async function acceptInvite(input: AcceptInviteInput): Promise<{ household_id: string }> {
  return invokeWithAuth<{ household_id: string }>("accept-invite", input);
}

export async function changeRole(input: ChangeRoleInput): Promise<void> {
  await invokeWithAuth<{ ok: boolean }>("change-role", input);
}

export async function updateHousehold(householdId: string, patch: Partial<Household>): Promise<Household> {
  const { data, error } = await supabase.from("households").update(patch).eq("id", householdId).select("*").single();
  assertNoError(error);
  return data as Household;
}

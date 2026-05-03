import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAuthContext, requireAdminRole } from "../_shared/auth.ts";

type Payload = {
  household_id?: string;
  shift_id?: string;
  caregiver_user_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const auth = await getAuthContext(req);
  if (auth instanceof Response) return auth;

  const payload = (await req.json().catch(() => ({}))) as Payload;
  if (!payload.household_id || !payload.shift_id || !payload.caregiver_user_id) {
    return jsonResponse({ error: "household_id, shift_id, caregiver_user_id required" }, 400);
  }

  const roleCheck = await requireAdminRole(auth.adminClient, payload.household_id, auth.userId);
  if (roleCheck instanceof Response) return roleCheck;

  // Assignee must be a member of the household. We allow caregiver/editor/owner
  // (owners and editors can cover shifts themselves). Anything else is rejected.
  const { data: member, error: memberErr } = await auth.adminClient
    .from("household_members")
    .select("role")
    .eq("household_id", payload.household_id)
    .eq("user_id", payload.caregiver_user_id)
    .maybeSingle();

  if (memberErr) return jsonResponse({ error: memberErr.message }, 500);
  if (!member) return jsonResponse({ error: "Assignee is not a household member" }, 400);
  if (!["owner", "editor", "caregiver"].includes(member.role)) {
    return jsonResponse({ error: "Assignee role cannot be assigned a shift" }, 400);
  }

  // Load the shift so we can snapshot title/times onto the assignment row.
  const { data: shift, error: shiftErr } = await auth.adminClient
    .from("shifts")
    .select("id, title, start_datetime, end_datetime, household_id")
    .eq("id", payload.shift_id)
    .maybeSingle();

  if (shiftErr) return jsonResponse({ error: shiftErr.message }, 500);
  if (!shift || shift.household_id !== payload.household_id) {
    return jsonResponse({ error: "Shift not found in this household" }, 404);
  }

  // Upsert the assignment. Re-assigning the same caregiver resets status to
  // 'pending' and clears any prior response, so the admin gets a fresh accept loop.
  const { data: assignment, error: upErr } = await auth.adminClient
    .from("shift_assignments")
    .upsert(
      {
        household_id: payload.household_id,
        shift_id: payload.shift_id,
        caregiver_user_id: payload.caregiver_user_id,
        assigned_by_user_id: auth.userId,
        status: "pending",
        assigned_at: new Date().toISOString(),
        responded_at: null,
        response_note: null,
        snapshot_start: shift.start_datetime,
        snapshot_end: shift.end_datetime,
        snapshot_title: shift.title
      },
      { onConflict: "shift_id,caregiver_user_id" }
    )
    .select("id")
    .single();

  if (upErr) return jsonResponse({ error: upErr.message }, 400);

  // Keep shifts.caregiver_user_id in sync for backward compat with existing
  // queries (SchedulePage agenda, clock-in filter, etc. still read this column).
  const { error: syncErr } = await auth.adminClient
    .from("shifts")
    .update({ caregiver_user_id: payload.caregiver_user_id })
    .eq("id", payload.shift_id);

  if (syncErr) return jsonResponse({ error: syncErr.message }, 400);

  // Notify the caregiver. If they are assigning the shift to themselves (admin
  // covering a shift), skip the notification — they already know.
  if (payload.caregiver_user_id !== auth.userId) {
    await auth.adminClient.from("notifications").insert({
      household_id: payload.household_id,
      user_id: payload.caregiver_user_id,
      type: "shift_assigned",
      title: "You have a new shift",
      body: `"${shift.title}" — please confirm or decline.`,
      link: `/app/shift/${shift.id}`
    });
  }

  return jsonResponse({ ok: true, assignment_id: assignment.id }, 200);
});

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

  const { data: member } = await auth.adminClient
    .from("household_members")
    .select("role")
    .eq("household_id", payload.household_id)
    .eq("user_id", payload.caregiver_user_id)
    .maybeSingle();
  if (!member) return jsonResponse({ error: "Caregiver is not a household member" }, 400);

  const { data: shift, error: shiftErr } = await auth.adminClient
    .from("shifts")
    .select("id, title, start_datetime, end_datetime, household_id")
    .eq("id", payload.shift_id)
    .maybeSingle();
  if (shiftErr) return jsonResponse({ error: shiftErr.message }, 500);
  if (!shift || shift.household_id !== payload.household_id) {
    return jsonResponse({ error: "Shift not found in this household" }, 404);
  }

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
        snapshot_title: shift.title,
      },
      { onConflict: "shift_id,caregiver_user_id" }
    )
    .select("id")
    .single();

  if (upErr) return jsonResponse({ error: upErr.message }, 400);

  await auth.adminClient
    .from("shifts")
    .update({ caregiver_user_id: payload.caregiver_user_id })
    .eq("id", payload.shift_id);

  await auth.adminClient.from("notifications").insert({
    household_id: payload.household_id,
    user_id: payload.caregiver_user_id,
    type: "shift_assigned",
    title: "You have a new shift",
    body: `"${shift.title}" — please confirm or decline.`,
    link: `/app/shift/${shift.id}`,
  });

  return jsonResponse({ ok: true, assignment_id: assignment.id }, 200);
});

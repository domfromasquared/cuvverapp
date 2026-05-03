import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAuthContext } from "../_shared/auth.ts";

type Payload = {
  assignment_id?: string;
  response?: "accepted" | "declined";
  note?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const auth = await getAuthContext(req);
  if (auth instanceof Response) return auth;

  const payload = (await req.json().catch(() => ({}))) as Payload;
  if (!payload.assignment_id || !payload.response) {
    return jsonResponse({ error: "assignment_id and response required" }, 400);
  }
  if (payload.response !== "accepted" && payload.response !== "declined") {
    return jsonResponse({ error: "response must be 'accepted' or 'declined'" }, 400);
  }

  const { data: assignment, error: loadErr } = await auth.adminClient
    .from("shift_assignments")
    .select("id, household_id, shift_id, caregiver_user_id, assigned_by_user_id, status, snapshot_title")
    .eq("id", payload.assignment_id)
    .maybeSingle();

  if (loadErr) return jsonResponse({ error: loadErr.message }, 500);
  if (!assignment) return jsonResponse({ error: "Assignment not found" }, 404);
  if (assignment.caregiver_user_id !== auth.userId) {
    return jsonResponse({ error: "Not your assignment" }, 403);
  }
  if (!["pending", "changed"].includes(assignment.status)) {
    return jsonResponse({ error: `Cannot respond to assignment in status '${assignment.status}'` }, 400);
  }

  const { error: updateErr } = await auth.adminClient
    .from("shift_assignments")
    .update({
      status: payload.response,
      responded_at: new Date().toISOString(),
      response_note: payload.note?.trim() || null,
    })
    .eq("id", assignment.id);

  if (updateErr) return jsonResponse({ error: updateErr.message }, 400);

  const responderProfile = await auth.adminClient
    .from("profiles")
    .select("display_name")
    .eq("id", auth.userId)
    .maybeSingle();
  const responderName = responderProfile.data?.display_name || "A caregiver";
  const verb = payload.response === "accepted" ? "accepted" : "declined";

  await auth.adminClient.from("notifications").insert({
    household_id: assignment.household_id,
    user_id: assignment.assigned_by_user_id,
    type: "shift_response",
    title: `${responderName} ${verb} a shift`,
    body: `${assignment.snapshot_title}${payload.note ? ` — "${payload.note}"` : ""}`,
    link: `/app/shift/${assignment.shift_id}`,
  });

  await auth.adminClient.from("feed_items").insert({
    household_id: assignment.household_id,
    type: "system_event",
    author_user_id: auth.userId,
    title: `Shift ${verb}`,
    body: `${responderName} ${verb} "${assignment.snapshot_title}"${payload.note ? `. Note: ${payload.note}` : ""}.`,
    shift_id: assignment.shift_id,
    is_critical: payload.response === "declined",
  });

  return jsonResponse({ ok: true, status: payload.response }, 200);
});

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

  const note = payload.note?.trim() || null;

  // Decline requires a note so the admin knows why. Accept allows an optional note.
  if (payload.response === "declined" && !note) {
    return jsonResponse({ error: "A note is required when declining a shift." }, 400);
  }

  // Load the assignment and verify the caller owns it.
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
    return jsonResponse(
      { error: `Cannot respond to assignment in status '${assignment.status}'` },
      400
    );
  }

  // Update the assignment.
  const { error: updateErr } = await auth.adminClient
    .from("shift_assignments")
    .update({
      status: payload.response,
      responded_at: new Date().toISOString(),
      response_note: note
    })
    .eq("id", assignment.id);

  if (updateErr) return jsonResponse({ error: updateErr.message }, 400);

  // Look up the responder's display name for the notification + feed body.
  const { data: responderProfile } = await auth.adminClient
    .from("profiles")
    .select("display_name")
    .eq("id", auth.userId)
    .maybeSingle();
  const responderName = responderProfile?.display_name?.trim() || "A caregiver";
  const verb = payload.response === "accepted" ? "accepted" : "declined";

  // Notify the admin who assigned the shift (skip if the caregiver and the
  // assigning admin are the same person — e.g., an owner who assigned themselves
  // and is now self-accepting).
  if (assignment.assigned_by_user_id !== auth.userId) {
    const notifBody = note
      ? `${assignment.snapshot_title} — "${note}"`
      : assignment.snapshot_title;

    await auth.adminClient.from("notifications").insert({
      household_id: assignment.household_id,
      user_id: assignment.assigned_by_user_id,
      type: "shift_response",
      title: `${responderName} ${verb} a shift`,
      body: notifBody,
      link: `/app/shift/${assignment.shift_id}`
    });
  }

  // System event into the household feed. Critical on decline so it surfaces
  // above the fold; informational on accept.
  const feedBody = note
    ? `${responderName} ${verb} "${assignment.snapshot_title}". Note: ${note}`
    : `${responderName} ${verb} "${assignment.snapshot_title}".`;

  await auth.adminClient.from("feed_items").insert({
    household_id: assignment.household_id,
    type: "system_event",
    author_user_id: auth.userId,
    title: `Shift ${verb}`,
    body: feedBody,
    shift_id: assignment.shift_id,
    is_critical: payload.response === "declined"
  });

  return jsonResponse({ ok: true, status: payload.response }, 200);
});

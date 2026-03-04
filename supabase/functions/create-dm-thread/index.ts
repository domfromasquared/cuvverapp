import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAuthContext } from "../_shared/auth.ts";

type Payload = {
  household_id?: string;
  context_type?: "shift" | "pto" | "feed_item";
  context_id?: string;
  participants?: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const auth = await getAuthContext(req);
  if (auth instanceof Response) return auth;

  const payload = (await req.json().catch(() => ({}))) as Payload;
  const householdId = payload.household_id;
  const contextType = payload.context_type;
  const contextId = payload.context_id;

  if (!householdId || !contextType || !contextId) {
    return jsonResponse({ error: "household_id, context_type, context_id required" }, 400);
  }

  if (!["shift", "pto", "feed_item"].includes(contextType)) {
    return jsonResponse({ error: "Invalid context_type" }, 400);
  }

  const { data: member, error: memberError } = await auth.adminClient
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (memberError) return jsonResponse({ error: memberError.message }, 500);
  if (!member) return jsonResponse({ error: "Not a household member" }, 403);

  const { data: household, error: householdError } = await auth.adminClient
    .from("households")
    .select("admin_controls")
    .eq("id", householdId)
    .single();

  if (householdError) return jsonResponse({ error: householdError.message }, 500);
  const enabled = Boolean((household.admin_controls as Record<string, unknown>).dms_enabled);
  if (!enabled) return jsonResponse({ error: "DMs disabled" }, 403);

  const { data: thread, error: threadError } = await auth.adminClient
    .from("dm_threads")
    .insert({
      household_id: householdId,
      context_type: contextType,
      context_id: contextId,
      created_by_user_id: auth.userId
    })
    .select("id")
    .single();

  if (threadError || !thread) return jsonResponse({ error: threadError?.message ?? "Unable to create thread" }, 400);

  const participants = Array.from(new Set([auth.userId, ...(payload.participants ?? [])]));
  if (participants.length) {
    const rows = participants.map((userId) => ({ thread_id: thread.id, user_id: userId }));
    const { error: participantsError } = await auth.adminClient.from("dm_thread_participants").insert(rows);
    if (participantsError) return jsonResponse({ error: participantsError.message }, 400);
  }

  return jsonResponse({ thread_id: thread.id }, 200);
});

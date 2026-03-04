import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAuthContext, requireAdminRole } from "../_shared/auth.ts";

type Payload = {
  household_id?: string;
  title?: string;
  body?: string;
  is_critical?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const auth = await getAuthContext(req);
  if (auth instanceof Response) return auth;

  const payload = (await req.json().catch(() => ({}))) as Payload;
  const householdId = payload.household_id;
  const title = payload.title?.trim();
  const body = payload.body?.trim();

  if (!householdId || !title || !body) {
    return jsonResponse({ error: "household_id, title, body required" }, 400);
  }

  const roleCheck = await requireAdminRole(auth.adminClient, householdId, auth.userId);
  if (roleCheck instanceof Response) return roleCheck;

  const { data: existing, error: fetchError } = await auth.adminClient
    .from("feed_items")
    .select("id")
    .eq("household_id", householdId)
    .eq("type", "coverage_brief")
    .maybeSingle();

  if (fetchError) return jsonResponse({ error: fetchError.message }, 500);

  if (!existing) {
    const { error } = await auth.adminClient.from("feed_items").insert({
      household_id: householdId,
      type: "coverage_brief",
      author_user_id: auth.userId,
      title,
      body,
      is_pinned: true,
      is_critical: payload.is_critical ?? true,
      template_tag: "Coverage"
    });

    if (error) return jsonResponse({ error: error.message }, 400);
  } else {
    const { error } = await auth.adminClient
      .from("feed_items")
      .update({
        title,
        body,
        is_pinned: true,
        is_critical: payload.is_critical ?? true,
        author_user_id: auth.userId
      })
      .eq("id", existing.id)
      .eq("household_id", householdId);

    if (error) return jsonResponse({ error: error.message }, 400);
  }

  return jsonResponse({ ok: true }, 200);
});

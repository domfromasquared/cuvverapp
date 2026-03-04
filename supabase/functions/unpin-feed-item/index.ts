import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAuthContext, requireAdminRole } from "../_shared/auth.ts";

type Payload = {
  household_id?: string;
  feed_item_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const auth = await getAuthContext(req);
  if (auth instanceof Response) return auth;

  const payload = (await req.json().catch(() => ({}))) as Payload;
  if (!payload.household_id || !payload.feed_item_id) {
    return jsonResponse({ error: "household_id and feed_item_id required" }, 400);
  }

  const roleCheck = await requireAdminRole(auth.adminClient, payload.household_id, auth.userId);
  if (roleCheck instanceof Response) return roleCheck;

  const { data: feedItem, error: fetchError } = await auth.adminClient
    .from("feed_items")
    .select("type")
    .eq("id", payload.feed_item_id)
    .single();

  if (fetchError) return jsonResponse({ error: fetchError.message }, 400);
  if (feedItem.type === "coverage_brief") {
    return jsonResponse({ error: "Coverage Brief must remain pinned" }, 409);
  }

  const { error } = await auth.adminClient
    .from("feed_items")
    .update({ is_pinned: false })
    .eq("id", payload.feed_item_id)
    .eq("household_id", payload.household_id);

  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ ok: true }, 200);
});

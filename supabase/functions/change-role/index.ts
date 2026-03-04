import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAuthContext, requireAdminRole } from "../_shared/auth.ts";

type Payload = {
  household_id?: string;
  target_user_id?: string;
  new_role?: "owner" | "editor" | "caregiver" | "viewer";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const auth = await getAuthContext(req);
  if (auth instanceof Response) return auth;

  const payload = (await req.json().catch(() => ({}))) as Payload;
  const householdId = payload.household_id;
  const targetUserId = payload.target_user_id;
  const newRole = payload.new_role;

  if (!householdId || !targetUserId || !newRole) {
    return jsonResponse({ error: "household_id, target_user_id, new_role required" }, 400);
  }

  const actorRole = await requireAdminRole(auth.adminClient, householdId, auth.userId);
  if (actorRole instanceof Response) return actorRole;

  const { data: targetMember, error: targetError } = await auth.adminClient
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (targetError) return jsonResponse({ error: targetError.message }, 500);
  if (!targetMember) return jsonResponse({ error: "Target member not found" }, 404);

  if (actorRole === "editor" && (targetMember.role === "owner" || newRole === "owner")) {
    return jsonResponse({ error: "Editors cannot change owner roles" }, 403);
  }

  if (targetMember.role === "owner" && newRole !== "owner") {
    if (actorRole !== "owner") {
      return jsonResponse({ error: "Only owner can demote owners" }, 403);
    }

    const { count, error: countError } = await auth.adminClient
      .from("household_members")
      .select("user_id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("role", "owner");

    if (countError) return jsonResponse({ error: countError.message }, 500);
    if ((count ?? 0) <= 1) {
      return jsonResponse({ error: "Cannot remove last owner" }, 409);
    }
  }

  if (newRole === "owner" && actorRole !== "owner") {
    return jsonResponse({ error: "Only owner can transfer ownership" }, 403);
  }

  const { error: updateError } = await auth.adminClient
    .from("household_members")
    .update({ role: newRole })
    .eq("household_id", householdId)
    .eq("user_id", targetUserId);

  if (updateError) return jsonResponse({ error: updateError.message }, 400);

  return jsonResponse({ ok: true }, 200);
});

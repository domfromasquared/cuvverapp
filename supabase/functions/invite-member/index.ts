import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAuthContext, requireAdminRole } from "../_shared/auth.ts";

type Payload = {
  household_id?: string;
  email?: string;
  role?: "owner" | "editor" | "caregiver" | "viewer";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const auth = await getAuthContext(req);
  if (auth instanceof Response) return auth;

  const payload = (await req.json().catch(() => ({}))) as Payload;
  const householdId = payload.household_id;
  const email = payload.email?.trim().toLowerCase();
  const role = payload.role;

  if (!householdId || !email || !role) {
    return jsonResponse({ error: "household_id, email, role required" }, 400);
  }

  if (role === "owner") {
    return jsonResponse({ error: "Use ownership transfer flow for owner invites" }, 400);
  }

  const roleCheck = await requireAdminRole(auth.adminClient, householdId, auth.userId);
  if (roleCheck instanceof Response) return roleCheck;

  const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const appUrl = (Deno.env.get("PUBLIC_APP_URL") ?? "http://localhost:5173").replace(/\/+$/, "");

  const { data, error } = await auth.adminClient
    .from("invites")
    .insert({ household_id: householdId, email, role, token, expires_at: expiresAt })
    .select("token")
    .single();

  if (error || !data) return jsonResponse({ error: error?.message ?? "Unable to create invite" }, 400);

  return jsonResponse({ token: data.token, invite_link: `${appUrl}/#/auth?invite=${data.token}` }, 200);
});

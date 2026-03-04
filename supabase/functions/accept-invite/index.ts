import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAuthContext } from "../_shared/auth.ts";

type Payload = {
  token?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const auth = await getAuthContext(req);
  if (auth instanceof Response) return auth;

  const payload = (await req.json().catch(() => ({}))) as Payload;
  const token = payload.token?.trim();
  if (!token) return jsonResponse({ error: "token required" }, 400);

  const admin = auth.adminClient;
  const { data: invite, error: inviteError } = await admin
    .from("invites")
    .select("id,household_id,role,email,expires_at,accepted_at")
    .eq("token", token)
    .maybeSingle();

  if (inviteError) return jsonResponse({ error: inviteError.message }, 500);
  if (!invite) return jsonResponse({ error: "Invite not found" }, 404);
  if (invite.accepted_at) return jsonResponse({ error: "Invite already accepted" }, 409);
  if (new Date(invite.expires_at).getTime() < Date.now()) return jsonResponse({ error: "Invite expired" }, 410);

  const { error: memberError } = await admin.from("household_members").upsert(
    {
      household_id: invite.household_id,
      user_id: auth.userId,
      role: invite.role
    },
    { onConflict: "household_id,user_id" }
  );

  if (memberError) return jsonResponse({ error: memberError.message }, 400);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ household_id: invite.household_id })
    .eq("id", auth.userId);

  if (profileError) return jsonResponse({ error: profileError.message }, 400);

  const { error: inviteMarkError } = await admin
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  if (inviteMarkError) return jsonResponse({ error: inviteMarkError.message }, 400);

  return jsonResponse({ household_id: invite.household_id }, 200);
});

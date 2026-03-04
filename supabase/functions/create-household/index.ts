import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAuthContext } from "../_shared/auth.ts";

type Payload = {
  household_name?: string;
  timezone?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await getAuthContext(req);
  if (auth instanceof Response) return auth;

  const payload = (await req.json().catch(() => ({}))) as Payload;
  const householdName = payload.household_name?.trim();
  const timezone = payload.timezone?.trim() || "America/Los_Angeles";

  if (!householdName) {
    return jsonResponse({ error: "household_name required" }, 400);
  }

  const admin = auth.adminClient;

  const { error: profileError } = await admin.from("profiles").upsert({
    id: auth.userId,
    email: auth.userEmail,
    display_name: auth.userEmail.split("@")[0],
    household_id: null
  });

  if (profileError) {
    return jsonResponse({ error: profileError.message }, 400);
  }

  const { data: household, error: householdError } = await admin
    .from("households")
    .insert({ name: householdName, timezone })
    .select("id")
    .single();

  if (householdError || !household) {
    return jsonResponse({ error: householdError?.message ?? "Unable to create household" }, 400);
  }

  const { error: memberError } = await admin.from("household_members").insert({
    household_id: household.id,
    user_id: auth.userId,
    role: "owner"
  });

  if (memberError) {
    return jsonResponse({ error: memberError.message }, 400);
  }

  const { error: profileUpdateError } = await admin
    .from("profiles")
    .update({ household_id: household.id })
    .eq("id", auth.userId);

  if (profileUpdateError) {
    return jsonResponse({ error: profileUpdateError.message }, 400);
  }

  return jsonResponse({ household_id: household.id }, 200);
});

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { jsonResponse } from "./cors.ts";

export interface AuthContext {
  authHeader: string;
  supabaseUrl: string;
  anonKey: string;
  serviceKey: string;
  userId: string;
  userEmail: string;
  userClient: SupabaseClient;
  adminClient: SupabaseClient;
}

export async function getAuthContext(req: Request): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing Authorization Bearer token" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ error: "Missing environment variables" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: userError?.message ?? "Unauthorized" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  return {
    authHeader,
    supabaseUrl,
    anonKey,
    serviceKey,
    userId: userData.user.id,
    userEmail: userData.user.email ?? "",
    userClient,
    adminClient
  };
}

export async function requireAdminRole(adminClient: SupabaseClient, householdId: string, userId: string): Promise<"owner" | "editor" | Response> {
  const { data, error } = await adminClient
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return jsonResponse({ error: error.message }, 500);
  if (!data || (data.role !== "owner" && data.role !== "editor")) {
    return jsonResponse({ error: "Admin access required" }, 403);
  }

  return data.role as "owner" | "editor";
}

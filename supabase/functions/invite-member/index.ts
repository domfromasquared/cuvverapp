import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAuthContext, requireAdminRole } from "../_shared/auth.ts";

type Payload = {
  household_id?: string;
  email?: string;
  role?: "owner" | "editor" | "caregiver" | "viewer";
};

type EmailDispatchResult = {
  sent: boolean;
  provider: string;
  error?: string;
};

async function sendInviteEmail(input: { email: string; role: string; inviteLink: string; householdId: string }): Promise<EmailDispatchResult> {
  const provider = (Deno.env.get("INVITE_EMAIL_PROVIDER") ?? "none").trim().toLowerCase();
  if (provider === "none" || provider === "") {
    return { sent: false, provider: "none" };
  }

  if (provider !== "resend") {
    return {
      sent: false,
      provider,
      error: `Unsupported provider: ${provider}. Supported: resend`
    };
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const fromEmail = Deno.env.get("INVITE_EMAIL_FROM")?.trim();
  if (!resendApiKey || !fromEmail) {
    return {
      sent: false,
      provider: "resend",
      error: "Missing RESEND_API_KEY or INVITE_EMAIL_FROM"
    };
  }

  const subjectPrefix = Deno.env.get("INVITE_EMAIL_SUBJECT_PREFIX")?.trim() || "Cuvver";
  const subject = `${subjectPrefix}: household invitation`;
  const text = [
    `You were invited to join a Cuvver household as ${input.role}.`,
    "",
    `Accept invite: ${input.inviteLink}`,
    "",
    "This invite link expires in 7 days.",
    "",
    `Household ID: ${input.householdId}`
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2 style="margin: 0 0 12px;">Cuvver household invitation</h2>
      <p style="margin: 0 0 12px;">You were invited to join a household as <strong>${input.role}</strong>.</p>
      <p style="margin: 0 0 18px;">
        <a href="${input.inviteLink}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#3f5f53;color:#ffffff;text-decoration:none;">
          Accept invite
        </a>
      </p>
      <p style="margin: 0 0 8px;">Or use this link:</p>
      <p style="margin: 0 0 12px; word-break: break-all;"><a href="${input.inviteLink}">${input.inviteLink}</a></p>
      <p style="margin: 0; color:#6b7280; font-size: 12px;">This invite link expires in 7 days.</p>
    </div>
  `.trim();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [input.email],
      subject,
      text,
      html
    })
  });

  if (!response.ok) {
    const details = await response.text();
    return {
      sent: false,
      provider: "resend",
      error: `Resend ${response.status}: ${details.slice(0, 300)}`
    };
  }

  return { sent: true, provider: "resend" };
}

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

  const inviteLink = `${appUrl}/#/auth?invite=${data.token}`;
  const emailResult = await sendInviteEmail({
    email,
    role,
    inviteLink,
    householdId
  });

  return jsonResponse(
    {
      token: data.token,
      invite_link: inviteLink,
      email_sent: emailResult.sent,
      email_provider: emailResult.provider,
      ...(emailResult.error ? { email_error: emailResult.error } : {})
    },
    200
  );
});

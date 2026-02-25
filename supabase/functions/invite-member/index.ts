import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- Inline Postmark sender with retries ----------

async function sendInviteEmail(
  to: string,
  organizationName: string,
  inviteUrl: string
): Promise<void> {
  const token = Deno.env.get("POSTMARK_SERVER_TOKEN");
  if (!token) {
    console.warn("POSTMARK_SERVER_TOKEN not set — skipping invite email");
    return;
  }

  const fromEmail = Deno.env.get("POSTMARK_FROM_EMAIL") || "noreply@quizory.app";
  const subject = `Pozivnica za ${organizationName} na Quizory`;
  const html = `
<!DOCTYPE html>
<html lang="sr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:#1a1a2e;padding:24px 32px;">
          <span style="color:#f59e0b;font-size:20px;font-weight:700;">🏆 Quizory</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a2e;">Pozvani ste u ${organizationName}!</h1>
          <p style="color:#52525b;line-height:1.6;">
            Dobili ste pozivnicu da se pridružite organizaciji <strong>${organizationName}</strong> na platformi Quizory.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${inviteUrl}" style="display:inline-block;background:#f59e0b;color:#1a1a2e;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
              Prihvati pozivnicu
            </a>
          </div>
          <p style="color:#a1a1aa;font-size:13px;">
            Ako nemate nalog, registrujte se koristeći email adresu na koju ste primili ovu poruku i automatski ćete biti dodati u organizaciju.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">© ${new Date().getFullYear()} Quizory</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": token,
        },
        body: JSON.stringify({ From: fromEmail, To: to, Subject: subject, HtmlBody: html }),
      });
      const data = await res.json();
      if (res.ok && data.MessageID) {
        console.log(`Invite email sent to ${to}, messageId=${data.MessageID}`);
        return;
      }
      console.error(`Postmark attempt ${attempt}:`, data.Message || res.status);
      if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
    } catch (err) {
      console.error(`Postmark attempt ${attempt} exception:`, (err as Error).message);
    }
    if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
  }
  console.error(`Failed to send invite email to ${to} after ${maxRetries} attempts`);
}

// ---------- Main handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, organization_id, role = "user" } = await req.json();
    if (!email || !organization_id) {
      return new Response(JSON.stringify({ error: "Missing email or organization_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if caller is admin/owner of org
    const { data: callerRole } = await adminClient.rpc("get_user_org_role", {
      _user_id: caller.id,
      _org_id: organization_id,
    });
    if (!callerRole || !["owner", "admin"].includes(callerRole)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get org name for email
    const { data: org } = await adminClient
      .from("organizations")
      .select("name")
      .eq("id", organization_id)
      .single();
    const orgName = org?.name || "Organizacija";

    // Determine the app URL for invite link
    const appUrl = Deno.env.get("APP_URL") || "https://quizory.app";
    const inviteUrl = `${appUrl}/register`;

    // Check if user already exists
    const { data: { users } } = await adminClient.auth.admin.listUsers();
    const existingUser = users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      // Check if already a member
      const { data: existingMembership } = await adminClient
        .from("memberships")
        .select("id")
        .eq("user_id", existingUser.id)
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (existingMembership) {
        return new Response(JSON.stringify({ error: "already_member" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Add membership directly
      const { error: memberError } = await adminClient.from("memberships").insert({
        user_id: existingUser.id,
        organization_id,
        role,
        invited_by: caller.id,
      });

      if (memberError) {
        return new Response(JSON.stringify({ error: memberError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send notification email (fire-and-forget)
      sendInviteEmail(email, orgName, inviteUrl).catch(() => {});

      return new Response(JSON.stringify({ status: "added", email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Store pending invite
      const { error: inviteStoreError } = await adminClient
        .from("pending_invites")
        .upsert(
          { email: email.toLowerCase(), organization_id, role, invited_by: caller.id },
          { onConflict: "email,organization_id" }
        );

      if (inviteStoreError) {
        return new Response(JSON.stringify({ error: inviteStoreError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send invite email (fire-and-forget)
      sendInviteEmail(email, orgName, inviteUrl).catch(() => {});

      return new Response(JSON.stringify({ status: "invited", email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const baseLayout = (content: string) => `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#09090b;font-family:Inter,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;padding:28px;">
            <tr><td>${content}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

async function sendViaPostmark(to: string, subject: string, htmlBody: string) {
  const token = Deno.env.get("POSTMARK_SERVER_TOKEN");
  const fromEmail = Deno.env.get("POSTMARK_FROM_EMAIL") || "noreply@quizory.app";

  if (!token) throw new Error("POSTMARK_SERVER_TOKEN is not configured");

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: fromEmail,
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.Message || `Postmark error (${res.status})`);
  }

  return data?.MessageID as string | undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, email, password, fullName, redirectTo } = await req.json();
    if (!action || !email) {
      return new Response(JSON.stringify({ error: "action and email are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRole);

    if (action === "signup") {
      if (!password) {
        return new Response(JSON.stringify({ error: "password is required for signup" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await admin.auth.admin.generateLink({
        type: "signup",
        email,
        password,
        options: {
          data: { full_name: fullName || "" },
          redirectTo,
        },
      });

      if (error) throw error;

      const confirmUrl = data?.properties?.action_link;
      if (!confirmUrl) throw new Error("Failed to generate confirmation link");

      const html = baseLayout(`
        <h1 style="margin:0 0 12px;font-size:24px;color:#111827;">Potvrdite vaš nalog</h1>
        <p style="color:#4b5563;line-height:1.6;">Kliknite na dugme ispod da potvrdite email adresu i aktivirate Quizestro nalog.</p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${confirmUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Potvrdi email</a>
        </div>
      `);

      const messageId = await sendViaPostmark(email, "Potvrda naloga — Quizestro", html);
      return new Response(JSON.stringify({ success: true, messageId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "recovery") {
      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (error) throw error;

      const resetUrl = data?.properties?.action_link;
      if (!resetUrl) throw new Error("Failed to generate reset link");

      const html = baseLayout(`
        <h1 style="margin:0 0 12px;font-size:24px;color:#111827;">Reset lozinke</h1>
        <p style="color:#4b5563;line-height:1.6;">Kliknite na dugme ispod da postavite novu lozinku.</p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${resetUrl}" style="display:inline-block;background:#f59e0b;color:#111827;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Resetuj lozinku</a>
        </div>
      `);

      const messageId = await sendViaPostmark(email, "Reset lozinke — Quizestro", html);
      return new Response(JSON.stringify({ success: true, messageId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auth-send-email error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

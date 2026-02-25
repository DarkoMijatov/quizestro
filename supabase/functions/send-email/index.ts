import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------- HTML Templates ----------

const baseLayout = (content: string) => `
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
          ${content}
        </td></tr>
        <tr><td style="padding:16px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
            © ${new Date().getFullYear()} Quizory. Sva prava zadržana.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const templates: Record<string, (vars: Record<string, string>) => { subject: string; html: string }> = {
  invite: (v) => ({
    subject: `Pozivnica za ${v.organizationName} na Quizory`,
    html: baseLayout(`
      <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a2e;">Pozvani ste u ${v.organizationName}!</h1>
      <p style="color:#52525b;line-height:1.6;">
        Dobili ste pozivnicu da se pridružite organizaciji <strong>${v.organizationName}</strong> na platformi Quizory.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${v.inviteUrl}" style="display:inline-block;background:#f59e0b;color:#1a1a2e;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
          Prihvati pozivnicu
        </a>
      </div>
      <p style="color:#a1a1aa;font-size:13px;">
        Ako nemate nalog, registrujte se koristeći email adresu na koju ste primili ovu poruku i automatski ćete biti dodati u organizaciju.
      </p>
    `),
  }),

  password_reset: (v) => ({
    subject: "Resetovanje lozinke — Quizory",
    html: baseLayout(`
      <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a2e;">Resetovanje lozinke</h1>
      <p style="color:#52525b;line-height:1.6;">
        Primili smo zahtev za resetovanje vaše lozinke. Kliknite na dugme ispod da postavite novu lozinku.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${v.resetUrl}" style="display:inline-block;background:#f59e0b;color:#1a1a2e;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
          Resetuj lozinku
        </a>
      </div>
      <p style="color:#a1a1aa;font-size:13px;">
        Ako niste tražili resetovanje lozinke, slobodno ignorišite ovaj email.
      </p>
    `),
  }),

  subscription_receipt: (v) => ({
    subject: `Potvrda pretplate — ${v.planName}`,
    html: baseLayout(`
      <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a2e;">Hvala na pretplati! 🎉</h1>
      <p style="color:#52525b;line-height:1.6;">
        Vaša pretplata na plan <strong>${v.planName}</strong> je aktivirana.
      </p>
      <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0;color:#1a1a2e;font-weight:600;">Plan: ${v.planName}</p>
      </div>
      <p style="color:#52525b;line-height:1.6;">
        Sada imate pristup svim premium funkcionalnostima. Uživajte!
      </p>
    `),
  }),
};

// ---------- Postmark sender with retries ----------

async function sendViaPostmark(
  apiToken: string,
  to: string,
  subject: string,
  htmlBody: string,
  fromEmail: string,
  maxRetries = 3
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  let lastError = "";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": apiToken,
        },
        body: JSON.stringify({
          From: fromEmail,
          To: to,
          Subject: subject,
          HtmlBody: htmlBody,
        }),
      });

      const data = await res.json();

      if (res.ok && data.MessageID) {
        return { success: true, messageId: data.MessageID };
      }

      lastError = data.Message || `HTTP ${res.status}`;
      console.error(`Postmark attempt ${attempt} failed:`, lastError);

      // Don't retry on client errors (except rate limit 429)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        break;
      }
    } catch (err) {
      lastError = (err as Error).message;
      console.error(`Postmark attempt ${attempt} exception:`, lastError);
    }

    // Exponential backoff before retry
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }

  return { success: false, error: lastError };
}

// ---------- Main handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const postmarkToken = Deno.env.get("POSTMARK_SERVER_TOKEN");
    if (!postmarkToken) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, to, variables } = await req.json();

    if (!type || !to) {
      return new Response(JSON.stringify({ error: "Missing type or to" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const templateFn = templates[type];
    if (!templateFn) {
      return new Response(JSON.stringify({ error: `Unknown template: ${type}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html } = templateFn(variables || {});
    const fromEmail = Deno.env.get("POSTMARK_FROM_EMAIL") || "noreply@quizory.app";

    const result = await sendViaPostmark(postmarkToken, to, subject, html, fromEmail);

    if (!result.success) {
      console.error(`Email send failed to ${to}, type=${type}:`, result.error);
      return new Response(
        JSON.stringify({ error: "Failed to send email", detail: result.error }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Email sent: type=${type}, to=${to}, messageId=${result.messageId}`);
    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

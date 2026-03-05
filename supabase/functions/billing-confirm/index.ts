import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { transaction_id, organization_id } = await req.json();
    if (!transaction_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: "transaction_id and organization_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: membership } = await serviceClient
      .from("memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", organization_id)
      .single();

    if (!membership || membership.role !== "owner") {
      return new Response(
        JSON.stringify({ error: "Only the organization owner can confirm billing" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiKey = Deno.env.get("PADDLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Billing not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const paddleBaseUrl = Deno.env.get("PADDLE_ENVIRONMENT") === "sandbox"
      ? "https://sandbox-api.paddle.com"
      : "https://api.paddle.com";

    const txRes = await fetch(`${paddleBaseUrl}/transactions/${transaction_id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!txRes.ok) {
      const errText = await txRes.text();
      console.error("Paddle transaction fetch error:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to verify transaction" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const txJson = await txRes.json();
    const tx = txJson?.data || {};
    const txStatus = tx?.status;
    const txOrgId = tx?.custom_data?.organization_id || tx?.custom_data?.organizationId;

    if (txOrgId && txOrgId !== organization_id) {
      return new Response(
        JSON.stringify({ error: "Transaction organization mismatch" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (txStatus !== "completed" && txStatus !== "billed") {
      return new Response(
        JSON.stringify({ ok: false, status: txStatus, message: "Transaction is not finalized yet" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const txAt =
      tx?.billed_at ||
      tx?.updated_at ||
      tx?.created_at ||
      new Date().toISOString();
    const trialEndsAt = addDaysIso(txAt, 14);
    const subscriptionId = tx?.subscription_id || tx?.subscription?.id || null;

    const updates: Record<string, unknown> = {
      subscription_tier: "premium",
      subscription_status: "active",
      trial_ends_at: trialEndsAt,
    };
    if (subscriptionId) updates.subscription_id = subscriptionId;

    const { error: updateError } = await serviceClient
      .from("organizations")
      .update(updates)
      .eq("id", organization_id);

    if (updateError) {
      console.error("Organization update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update organization" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, status: txStatus, trial_ends_at: trialEndsAt }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Billing confirm error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

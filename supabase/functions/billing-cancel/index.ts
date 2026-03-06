import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    const { organization_id } = await req.json();
    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify owner
    const { data: membership } = await serviceClient
      .from("memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", organization_id)
      .single();

    if (!membership || membership.role !== "owner") {
      return new Response(
        JSON.stringify({ error: "Only the organization owner can cancel" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get org billing state
    const { data: org } = await serviceClient
      .from("organizations")
      .select("subscription_id, subscription_status, subscription_tier, premium_override")
      .eq("id", organization_id)
      .single();

    // If already free with no subscription and no override, nothing to cancel
    if (
      (!org?.subscription_id) &&
      (!org?.premium_override) &&
      (org?.subscription_tier === "free" || !org?.subscription_tier)
    ) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If premium via gift code / override (no Paddle subscription), just reset to free
    if (org?.premium_override && !org?.subscription_id) {
      await serviceClient
        .from("organizations")
        .update({
          subscription_tier: "free",
          subscription_status: "none",
          premium_override: false,
          premium_override_until: null,
          premium_override_reason: null,
        })
        .eq("id", organization_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("PADDLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Billing not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paddleBaseUrl = Deno.env.get("PADDLE_ENVIRONMENT") === "sandbox"
      ? "https://sandbox-api.paddle.com"
      : "https://api.paddle.com";

    let subscriptionId = org?.subscription_id || null;

    // Fallback: find active subscription by custom_data.organization_id
    if (!subscriptionId) {
      const listRes = await fetch(`${paddleBaseUrl}/subscriptions`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (listRes.ok) {
        const listJson = await listRes.json();
        const subs = Array.isArray(listJson?.data) ? listJson.data : [];
        const match = subs.find((s: any) => {
          const subOrgId =
            s?.custom_data?.organization_id ||
            s?.custom_data?.organizationId;
          const status = (s?.status || "").toLowerCase();
          return (
            subOrgId === organization_id &&
            (status === "active" || status === "trialing" || status === "past_due")
          );
        });

        if (match?.id) {
          subscriptionId = match.id as string;
          await serviceClient
            .from("organizations")
            .update({ subscription_id: subscriptionId })
            .eq("id", organization_id);
        }
      }
    }

    if (!subscriptionId) {
      // No Paddle subscription found — just reset to free
      await serviceClient
        .from("organizations")
        .update({
          subscription_tier: "free",
          subscription_status: "none",
        })
        .eq("id", organization_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cancel subscription via Paddle API
    const cancelRes = await fetch(
      `${paddleBaseUrl}/subscriptions/${subscriptionId}/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          effective_from: "next_billing_period",
        }),
      }
    );

    if (!cancelRes.ok) {
      const errText = await cancelRes.text();
      console.error("Paddle cancel error:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to cancel subscription", details: errText }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update org status locally
    await serviceClient
      .from("organizations")
      .update({ subscription_status: "cancelled" })
      .eq("id", organization_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Cancel error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

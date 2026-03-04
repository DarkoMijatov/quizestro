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

    // Get org subscription_id
    const { data: org } = await serviceClient
      .from("organizations")
      .select("subscription_id")
      .eq("id", organization_id)
      .single();

    if (!org?.subscription_id) {
      return new Response(
        JSON.stringify({ error: "No active subscription found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Cancel subscription via Paddle API
    const cancelRes = await fetch(
      `${paddleBaseUrl}/subscriptions/${org.subscription_id}/cancel`,
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
        JSON.stringify({ error: "Failed to cancel subscription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

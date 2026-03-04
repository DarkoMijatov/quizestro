import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function encodeForm(data: Record<string, string>) {
  return new URLSearchParams(data).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { organization_id, variant_id } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Only the organization owner can upgrade" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const monthlyPrice = Deno.env.get("STRIPE_PRICE_ID_MONTHLY");
    const annualPrice = Deno.env.get("STRIPE_PRICE_ID_ANNUAL");
    const siteUrl = Deno.env.get("SITE_URL") || "https://quizestro.darkmsolutions.com";
    const selectedPrice = variant_id === "annual" ? annualPrice : monthlyPrice;

    if (!stripeKey || !selectedPrice) {
      return new Response(JSON.stringify({ error: "Stripe billing is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "";

    const body = encodeForm({
      mode: "subscription",
      "line_items[0][price]": selectedPrice,
      "line_items[0][quantity]": "1",
      success_url: `${siteUrl}/dashboard/pricing?checkout=success`,
      cancel_url: `${siteUrl}/dashboard/pricing?checkout=cancelled`,
      customer_email: userEmail,
      "metadata[organization_id]": organization_id,
      "metadata[user_id]": userId,
      "subscription_data[metadata][organization_id]": organization_id,
    });

    const checkoutRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const raw = await checkoutRes.text();
    if (!checkoutRes.ok) {
      let msg = "Failed to create Stripe checkout session";
      try {
        const parsed = JSON.parse(raw);
        msg = parsed?.error?.message || msg;
      } catch {
        // ignore
      }
      return new Response(JSON.stringify({ error: msg }), {
        status: checkoutRes.status >= 400 && checkoutRes.status < 500 ? 400 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checkoutData = JSON.parse(raw);
    return new Response(JSON.stringify({ checkout_url: checkoutData.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

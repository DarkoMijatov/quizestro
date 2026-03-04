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
    // Auth check
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

    // Parse body
    const { organization_id, variant_id } = await req.json();
    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify user is owner of the org
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
        JSON.stringify({ error: "Only the organization owner can upgrade" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Lemon Squeezy checkout
    const apiKey = Deno.env.get("LEMONSQUEEZY_API_KEY");
    const storeId = Deno.env.get("LEMONSQUEEZY_STORE_ID");
    const monthlyVariantId = Deno.env.get("LEMONSQUEEZY_VARIANT_ID_MONTHLY");
    const annualVariantId = Deno.env.get("LEMONSQUEEZY_VARIANT_ID_ANNUAL");

    const selectedVariant = variant_id === "annual" ? annualVariantId : monthlyVariantId;

    if (!apiKey || !storeId || !selectedVariant) {
      return new Response(
        JSON.stringify({ error: "Billing not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user email for checkout
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "";

    const checkoutRes = await fetch(
      "https://api.lemonsqueezy.com/v1/checkouts",
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.api+json",
          "Content-Type": "application/vnd.api+json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          data: {
            type: "checkouts",
            attributes: {
              checkout_data: {
                email: userEmail,
                custom: {
                  organization_id,
                },
              },
            },
            relationships: {
              store: { data: { type: "stores", id: storeId } },
              variant: { data: { type: "variants", id: selectedVariant } },
            },
          },
        }),
      }
    );

    if (!checkoutRes.ok) {
      const errText = await checkoutRes.text();
      console.error("Lemon Squeezy error:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to create checkout session" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const checkoutData = await checkoutRes.json();
    const checkoutUrl = checkoutData.data.attributes.url;

    return new Response(JSON.stringify({ checkout_url: checkoutUrl }), {
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

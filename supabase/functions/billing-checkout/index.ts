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

    // Create Paddle checkout transaction
    const apiKey = Deno.env.get("PADDLE_API_KEY");
    const monthlyPriceId = Deno.env.get("PADDLE_PRICE_ID_MONTHLY");
    const annualPriceId = Deno.env.get("PADDLE_PRICE_ID_ANNUAL");

    const selectedPriceId = variant_id === "annual" ? annualPriceId : monthlyPriceId;

    if (!apiKey || !selectedPriceId) {
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

    // Determine Paddle API base URL (sandbox vs production)
    const paddleBaseUrl = Deno.env.get("PADDLE_ENVIRONMENT") === "sandbox"
      ? "https://sandbox-api.paddle.com"
      : "https://api.paddle.com";
    const appUrl = (Deno.env.get("APP_URL") || req.headers.get("origin") || "").replace(/\/$/, "");

    if (!appUrl) {
      return new Response(
        JSON.stringify({ error: "APP_URL is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const transactionRes = await fetch(
      `${paddleBaseUrl}/transactions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          items: [
            {
              price_id: selectedPriceId,
              quantity: 1,
            },
          ],
          customer_email: userEmail,
          custom_data: {
            organization_id,
          },
          collection_mode: "automatic",
          checkout: {
            url: `${appUrl}/billing/success`,
          },
        }),
      }
    );

    if (!transactionRes.ok) {
      const errText = await transactionRes.text();
      console.error("Paddle error:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to create checkout session" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const transactionData = await transactionRes.json();
    const checkoutUrl = transactionData.data?.checkout?.url;
    const transactionId = transactionData.data?.id;

    return new Response(
      JSON.stringify({
        checkout_url: checkoutUrl,
        transaction_id: transactionId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Checkout error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

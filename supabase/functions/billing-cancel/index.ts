import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  findOrganizationSubscription,
  isPaddleSubscriptionId,
  subscriptionBelongsToOrganization,
} from "../_shared/billing-validation.ts";

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

    const { data: org } = await serviceClient
      .from("organizations")
      .select("subscription_id, subscription_status, subscription_tier, premium_override")
      .eq("id", organization_id)
      .single();

    if (
      (!org?.subscription_id) &&
      (!org?.premium_override) &&
      (org?.subscription_tier === "free" || !org?.subscription_tier)
    ) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (org?.premium_override && !org?.subscription_id) {
      const { error: resetError } = await serviceClient
        .from("organizations")
        .update({
          subscription_tier: "free",
          subscription_status: "none",
          premium_override: false,
          premium_override_until: null,
          premium_override_reason: null,
        })
        .eq("id", organization_id);

      if (resetError) {
        console.error("Failed to reset premium override:", resetError);
        return new Response(JSON.stringify({ error: "Failed to update billing state" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

    const discoverSubscription = async (): Promise<any | null> => {
      let url = `${paddleBaseUrl}/subscriptions?per_page=200`;

      for (let page = 0; page < 10 && url; page++) {
        const listRes = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (!listRes.ok) {
          const errText = await listRes.text();
          console.error("Paddle subscription discovery error:", errText);
          return null;
        }

        const listJson = await listRes.json();
        const subscriptions = Array.isArray(listJson?.data) ? listJson.data : [];
        const match = findOrganizationSubscription(subscriptions, organization_id);
        if (match) return match;

        const next = listJson?.meta?.pagination?.next;
        url = typeof next === "string" && next.length > 0 ? next : "";
      }

      return null;
    };

    let subscriptionId = isPaddleSubscriptionId(org?.subscription_id)
      ? org.subscription_id
      : null;
    let subscription: any | null = null;

    if (subscriptionId) {
      const subRes = await fetch(`${paddleBaseUrl}/subscriptions/${subscriptionId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (subRes.ok) {
        const subJson = await subRes.json();
        const candidate = subJson?.data;
        if (subscriptionBelongsToOrganization(candidate, organization_id)) {
          subscription = candidate;
        } else {
          console.error("Stored Paddle subscription does not belong to organization", organization_id);
          subscriptionId = null;
        }
      } else if (subRes.status === 404) {
        console.warn("Stored Paddle subscription not found; attempting recovery", subscriptionId);
        subscriptionId = null;
      } else {
        const errText = await subRes.text();
        console.error("Paddle fetch subscription error:", errText);
        return new Response(
          JSON.stringify({ error: "Failed to fetch subscription details" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!subscription) {
      subscription = await discoverSubscription();
      subscriptionId = isPaddleSubscriptionId(subscription?.id) ? subscription.id : null;

      if (subscriptionId) {
        const { error: persistError } = await serviceClient
          .from("organizations")
          .update({ subscription_id: subscriptionId })
          .eq("id", organization_id);
        if (persistError) {
          console.error("Failed to persist recovered subscription id:", persistError);
        }
      }
    }

    if (!subscription || !subscriptionId) {
      return new Response(
        JSON.stringify({ error: "No active Paddle subscription found for this organization" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cancelUrl = subscription?.management_urls?.cancel;
    if (!cancelUrl) {
      console.error("No cancel URL in subscription management URLs");
      return new Response(
        JSON.stringify({ error: "Cancel URL not available for this subscription" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ cancel_url: cancelUrl }), {
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

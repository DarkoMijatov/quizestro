import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function verifyHmac(secret: string, body: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hex === signature;
}

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
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature");
    const webhookSecret = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET");

    // Verify signature
    if (!signature || !webhookSecret) {
      console.error("Missing signature or webhook secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValid = await verifyHmac(webhookSecret, rawBody, signature);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    const eventName = payload.meta?.event_name;
    const eventId = payload.meta?.custom_data?.event_id || `${eventName}_${Date.now()}`;

    console.log(`Webhook received: ${eventName}`, JSON.stringify(payload.meta));

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Idempotency check
    const { data: existingEvent } = await serviceClient
      .from("webhook_events")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEvent) {
      console.log(`Event ${eventId} already processed, skipping`);
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the event
    await serviceClient.from("webhook_events").insert({
      event_id: eventId,
      event_type: eventName,
      payload,
    });

    // Extract data
    const subscriptionData = payload.data?.attributes;
    const organizationId =
      payload.meta?.custom_data?.organization_id ||
      subscriptionData?.custom_data?.organization_id;
    const subscriptionId = String(payload.data?.id || "");
    const currentPeriodEnd = subscriptionData?.renews_at || subscriptionData?.ends_at;

    if (!organizationId) {
      console.error("No organization_id in webhook payload");
      return new Response(
        JSON.stringify({ error: "Missing organization_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const handledEvents = [
      "subscription_created",
      "subscription_updated",
      "subscription_cancelled",
      "subscription_expired",
      "subscription_payment_failed",
    ];

    if (!handledEvents.includes(eventName)) {
      console.log(`Unhandled event type: ${eventName}`);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updates: Record<string, unknown> = {};

    if (
      eventName === "subscription_created" ||
      eventName === "subscription_updated"
    ) {
      const status = subscriptionData?.status;
      updates = {
        subscription_tier: "premium",
        subscription_status: status === "active" ? "active" : status,
        subscription_id: subscriptionId,
        current_period_end: currentPeriodEnd,
      };
    } else if (
      eventName === "subscription_cancelled" ||
      eventName === "subscription_expired"
    ) {
      updates = {
        subscription_status: "canceled",
        subscription_tier: "free",
      };
    } else if (eventName === "subscription_payment_failed") {
      updates = {
        subscription_status: "past_due",
      };
    }

    const { error: updateError } = await serviceClient
      .from("organizations")
      .update(updates)
      .eq("id", organizationId);

    if (updateError) {
      console.error("Failed to update organization:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update organization" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `Organization ${organizationId} updated: ${JSON.stringify(updates)}`
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function verifyPaddleSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) return false;

  // Paddle Billing webhook signature format: ts=TIMESTAMP;h1=HASH
  const parts: Record<string, string> = {};
  for (const part of signature.split(";")) {
    const [key, value] = part.split("=");
    if (key && value) parts[key] = value;
  }

  const ts = parts["ts"];
  const h1 = parts["h1"];
  if (!ts || !h1) return false;

  const signedPayload = `${ts}:${rawBody}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hex === h1;
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
    const signature = req.headers.get("paddle-signature");
    const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET");

    if (!signature || !webhookSecret) {
      console.error("Missing signature or webhook secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValid = await verifyPaddleSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event_type;
    const eventId = payload.event_id || `${eventType}_${Date.now()}`;

    console.log(`Paddle webhook received: ${eventType}`, eventId);

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
      event_type: eventType,
      payload,
    });

    // Extract organization_id from custom_data
    const subscriptionData = payload.data;
    const organizationId = subscriptionData?.custom_data?.organization_id;
    const subscriptionId = subscriptionData?.id || "";
    const currentPeriodEnd =
      subscriptionData?.current_billing_period?.ends_at ||
      subscriptionData?.scheduled_change?.effective_at;

    if (!organizationId) {
      console.error("No organization_id in webhook payload custom_data");
      return new Response(
        JSON.stringify({ error: "Missing organization_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const handledEvents = [
      "subscription.created",
      "subscription.updated",
      "subscription.canceled",
      "subscription.past_due",
      "subscription.activated",
    ];

    if (!handledEvents.includes(eventType)) {
      console.log(`Unhandled event type: ${eventType}`);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updates: Record<string, unknown> = {};
    const status = subscriptionData?.status;

    if (
      eventType === "subscription.created" ||
      eventType === "subscription.activated" ||
      eventType === "subscription.updated"
    ) {
      if (status === "active" || status === "trialing") {
        updates = {
          subscription_tier: "premium",
          subscription_status: "active",
          subscription_id: subscriptionId,
          current_period_end: currentPeriodEnd,
        };
      } else if (status === "canceled") {
        updates = {
          subscription_status: "canceled",
          subscription_tier: "free",
        };
      } else {
        updates = {
          subscription_status: status,
          subscription_id: subscriptionId,
        };
      }
    } else if (eventType === "subscription.canceled") {
      updates = {
        subscription_status: "canceled",
        subscription_tier: "free",
      };
    } else if (eventType === "subscription.past_due") {
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

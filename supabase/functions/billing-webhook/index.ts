import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string) {
  const parts = Object.fromEntries(sigHeader.split(",").map((part) => {
    const [k, v] = part.split("=");
    return [k, v];
  }));

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = new Uint8Array(digest);
  const provided = hexToBytes(signature);

  return timingSafeEqual(expected, provided);
}

async function fetchStripeSubscription(subscriptionId: string) {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  if (!res.ok) throw new Error("Failed to fetch subscription details from Stripe");
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!signature || !webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValid = await verifyStripeSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    const eventId = payload.id;
    const eventName = payload.type;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existingEvent } = await serviceClient
      .from("webhook_events")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEvent) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await serviceClient.from("webhook_events").insert({
      event_id: eventId,
      event_type: eventName,
      payload,
    });

    let organizationId: string | null = null;
    let updates: Record<string, unknown> = {};

    if (eventName === "checkout.session.completed") {
      const session = payload.data?.object;
      organizationId = session?.metadata?.organization_id || null;
      const subscriptionId = session?.subscription;

      if (organizationId && subscriptionId) {
        const sub = await fetchStripeSubscription(subscriptionId);
        updates = {
          subscription_tier: "premium",
          subscription_status: sub.status,
          subscription_id: subscriptionId,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        };
      }
    }

    if (eventName === "customer.subscription.updated") {
      const sub = payload.data?.object;
      organizationId = sub?.metadata?.organization_id || null;
      updates = {
        subscription_status: sub?.status,
        current_period_end: sub?.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        subscription_tier: sub?.status === "active" ? "premium" : "free",
      };
    }

    if (eventName === "customer.subscription.deleted") {
      const sub = payload.data?.object;
      organizationId = sub?.metadata?.organization_id || null;
      updates = {
        subscription_status: "canceled",
        subscription_tier: "free",
      };
    }

    if (!organizationId) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (Object.keys(updates).length) {
      const { error } = await serviceClient
        .from("organizations")
        .update(updates)
        .eq("id", organizationId);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("billing-webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

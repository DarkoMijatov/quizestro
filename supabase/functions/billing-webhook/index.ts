import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  extractOrganizationId,
  extractSubscriptionId,
  isOlderEvent,
  isWebhookTimestampFresh,
  timingSafeEqualHex,
} from "./webhook-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handledEvents = [
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
  "subscription.past_due",
  "subscription.activated",
  "transaction.completed",
];

async function verifyPaddleSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
  toleranceSeconds: number
): Promise<boolean> {
  if (!signature) return false;

  const parts: Record<string, string> = {};
  for (const part of signature.split(";")) {
    const [key, value] = part.split("=");
    if (key && value) parts[key] = value;
  }

  const ts = parts["ts"];
  const h1 = parts["h1"];
  if (!ts || !h1) return false;

  if (!isWebhookTimestampFresh(ts, Date.now(), toleranceSeconds)) {
    console.error("Rejected stale Paddle webhook timestamp");
    return false;
  }

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

  return timingSafeEqualHex(hex, h1);
}

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
    const rawBody = await req.text();
    const signature = req.headers.get("paddle-signature");
    const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET");
    const toleranceSeconds = Number(
      Deno.env.get("PADDLE_WEBHOOK_TOLERANCE_SECONDS") || "300"
    );

    if (!signature || !webhookSecret) {
      console.error("Missing signature or webhook secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValid = await verifyPaddleSignature(
      rawBody,
      signature,
      webhookSecret,
      Number.isFinite(toleranceSeconds) && toleranceSeconds > 0
        ? toleranceSeconds
        : 300
    );
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event_type as string | undefined;
    const eventId = payload.event_id as string | undefined;
    const occurredAt = (payload.occurred_at as string | undefined) || new Date().toISOString();

    if (!eventType || !eventId) {
      return new Response(JSON.stringify({ error: "Invalid Paddle event envelope" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Paddle webhook received: ${eventType}`, eventId);

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const data = payload.data;
    const organizationId = extractOrganizationId(data);

    const { data: existingEvent, error: existingEventError } = await serviceClient
      .from("webhook_events")
      .select("id, processing_status")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEventError) {
      console.error("Failed to check webhook idempotency:", existingEventError);
      return new Response(JSON.stringify({ error: "Webhook storage unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingEvent?.processing_status === "processed") {
      console.log(`Event ${eventId} already processed, skipping`);
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingEvent) {
      const { error: retryStateError } = await serviceClient
        .from("webhook_events")
        .update({
          processing_status: "processing",
          error_message: null,
          payload,
          occurred_at: occurredAt,
          organization_id: organizationId,
          updated_at: new Date().toISOString(),
        })
        .eq("event_id", eventId);

      if (retryStateError) {
        console.error("Failed to claim webhook retry:", retryStateError);
        return new Response(JSON.stringify({ error: "Webhook storage unavailable" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { error: insertEventError } = await serviceClient.from("webhook_events").insert({
        event_id: eventId,
        event_type: eventType,
        payload,
        processing_status: "processing",
        processed_at: null,
        occurred_at: occurredAt,
        organization_id: organizationId,
      });

      if (insertEventError) {
        if (insertEventError.code === "23505") {
          // Another invocation claimed the same Paddle event concurrently.
          return new Response(JSON.stringify({ ok: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.error("Failed to store webhook event:", insertEventError);
        return new Response(JSON.stringify({ error: "Webhook storage unavailable" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const markProcessed = async (extra: Record<string, unknown> = {}) => {
      const { error } = await serviceClient
        .from("webhook_events")
        .update({
          processing_status: "processed",
          processed_at: new Date().toISOString(),
          error_message: null,
          updated_at: new Date().toISOString(),
          ...extra,
        })
        .eq("event_id", eventId);
      if (error) console.error("Failed to mark webhook processed:", error);
    };

    const markFailed = async (message: string) => {
      const { error } = await serviceClient
        .from("webhook_events")
        .update({
          processing_status: "failed",
          error_message: message.slice(0, 1000),
          processed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("event_id", eventId);
      if (error) console.error("Failed to mark webhook failed:", error);
    };

    if (!handledEvents.includes(eventType)) {
      console.log(`Unhandled event type: ${eventType}`);
      await markProcessed();
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!organizationId) {
      console.error("No organization_id in webhook payload custom_data");
      await markProcessed();
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org, error: orgError } = await serviceClient
      .from("organizations")
      .select("billing_last_event_at")
      .eq("id", organizationId)
      .single();

    if (orgError) {
      console.error("Failed to load organization billing state:", orgError);
      await markFailed("Failed to load organization billing state");
      return new Response(JSON.stringify({ error: "Failed to load organization" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isOlderEvent(occurredAt, org?.billing_last_event_at)) {
      console.log(`Ignoring stale Paddle event ${eventId} for organization ${organizationId}`);
      await markProcessed();
      return new Response(JSON.stringify({ ok: true, skipped: true, stale: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subscriptionId = extractSubscriptionId(eventType, data);
    const transactionAt =
      occurredAt ||
      data?.billed_at ||
      data?.created_at ||
      new Date().toISOString();
    const trialEndsAt = addDaysIso(transactionAt, 14);
    const currentPeriodEnd =
      data?.current_billing_period?.ends_at ||
      data?.scheduled_change?.effective_at;
    const status = data?.status;

    let updates: Record<string, unknown> = {
      billing_last_event_at: occurredAt,
    };

    if (
      eventType === "subscription.created" ||
      eventType === "subscription.activated" ||
      eventType === "subscription.updated"
    ) {
      if (!subscriptionId) {
        await markFailed("Subscription event did not contain a valid sub_ identifier");
        return new Response(JSON.stringify({ error: "Invalid subscription identifier" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (status === "active" || status === "trialing") {
        updates = {
          ...updates,
          subscription_tier: "premium",
          subscription_status: "active",
          subscription_id: subscriptionId,
          current_period_end: currentPeriodEnd,
          ...(status === "trialing" ? { trial_ends_at: trialEndsAt } : {}),
        };
      } else if (status === "canceled") {
        updates = {
          ...updates,
          subscription_status: "canceled",
          subscription_tier: "free",
          subscription_id: subscriptionId,
        };
      } else {
        updates = {
          ...updates,
          subscription_status: status,
          subscription_id: subscriptionId,
        };
      }
    } else if (eventType === "subscription.canceled") {
      updates = {
        ...updates,
        subscription_status: "canceled",
        subscription_tier: "free",
        ...(subscriptionId ? { subscription_id: subscriptionId } : {}),
      };
    } else if (eventType === "subscription.past_due") {
      updates = {
        ...updates,
        subscription_status: "past_due",
        ...(subscriptionId ? { subscription_id: subscriptionId } : {}),
      };
    } else if (eventType === "transaction.completed") {
      updates = {
        ...updates,
        subscription_tier: "premium",
        subscription_status: "active",
        trial_ends_at: trialEndsAt,
        ...(subscriptionId ? { subscription_id: subscriptionId } : {}),
      };
    }

    const { error: updateError } = await serviceClient
      .from("organizations")
      .update(updates)
      .eq("id", organizationId);

    if (updateError) {
      console.error("Failed to update organization:", updateError);
      await markFailed("Failed to update organization");
      return new Response(JSON.stringify({ error: "Failed to update organization" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await markProcessed();

    console.log(
      `Organization ${organizationId} updated from ${eventType}: ${JSON.stringify(updates)}`
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

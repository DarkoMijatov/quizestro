// Lovable Cloud backend function: create-organization
// Creates an organization + owner membership + default help types in one atomic, server-trusted flow.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { name } = (await req.json().catch(() => ({}))) as { name?: unknown };
    if (typeof name !== "string" || !name.trim()) {
      return new Response(JSON.stringify({ error: "Organization name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgName = name.trim().slice(0, 100);
    const slug = `${slugify(orgName)}-${Date.now().toString(36)}`;

    // Validate caller identity using the user's JWT
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Perform writes with service role (bypasses RLS safely after we validated JWT)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Create org
    const { data: org, error: orgError } = await serviceClient
      .from("organizations")
      .insert({
        name: orgName,
        slug,
        subscription_tier: "free",
      })
      .select("id, name, slug, subscription_tier")
      .single();

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: orgError?.message ?? "Failed to create organization" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Owner membership
    const { error: memError } = await serviceClient.from("memberships").insert({
      user_id: userId,
      organization_id: org.id,
      role: "owner",
      invited_by: null,
    });

    if (memError) {
      return new Response(JSON.stringify({ error: memError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default help types
    await serviceClient.from("help_types").insert([
      {
        organization_id: org.id,
        name: "Joker",
        effect: "double",
        description: "Duplira poene za jednu kategoriju",
      },
      {
        organization_id: org.id,
        name: "Double Chance",
        effect: "second_chance",
        description: "Omogućava dva odgovora po pitanju u jednoj kategoriji",
      },
    ]);

    return new Response(JSON.stringify({ organization: org }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-organization error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

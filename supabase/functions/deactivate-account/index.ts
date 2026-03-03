import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client to get current user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client for privileged operations
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Get all memberships for this user
    const { data: memberships } = await admin
      .from("memberships")
      .select("id, organization_id, role")
      .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) {
      // No memberships, just deactivate profile
      await admin
        .from("profiles")
        .update({ is_deactivated: true, deactivated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      // Sign out user
      await admin.auth.admin.signOut(user.id, "global");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find orgs where user is owner
    const ownedOrgIds = memberships
      .filter((m) => m.role === "owner")
      .map((m) => m.organization_id);

    // Soft-delete owned organizations
    if (ownedOrgIds.length > 0) {
      await admin
        .from("organizations")
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .in("id", ownedOrgIds);

      // Remove all other members from owned orgs
      await admin
        .from("memberships")
        .delete()
        .in("organization_id", ownedOrgIds)
        .neq("user_id", user.id);

      // Delete pending invites for owned orgs
      await admin
        .from("pending_invites")
        .delete()
        .in("organization_id", ownedOrgIds);
    }

    // Remove all user's memberships
    await admin
      .from("memberships")
      .delete()
      .eq("user_id", user.id);

    // Deactivate profile
    await admin
      .from("profiles")
      .update({ is_deactivated: true, deactivated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    // Sign out user globally
    await admin.auth.admin.signOut(user.id, "global");

    return new Response(
      JSON.stringify({
        success: true,
        deleted_orgs: ownedOrgIds.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("deactivate-account error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

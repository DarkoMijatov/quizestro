import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, organization_id, role = "user" } = await req.json();
    if (!email || !organization_id) {
      return new Response(JSON.stringify({ error: "Missing email or organization_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if caller is admin/owner of org
    const { data: callerRole } = await adminClient.rpc("get_user_org_role", {
      _user_id: caller.id,
      _org_id: organization_id,
    });
    if (!callerRole || !["owner", "admin"].includes(callerRole)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get org name for email
    const { data: org } = await adminClient
      .from("organizations")
      .select("name")
      .eq("id", organization_id)
      .single();
    const orgName = org?.name || "Organizacija";

    const appUrl = Deno.env.get("APP_URL") || "https://quizestro.com";
    const inviteUrl = `${appUrl}/register`;

    // Send invite email via transactional email system
    const sendInviteEmail = async (toEmail: string) => {
      try {
        const { data, error } = await adminClient.functions.invoke("send-transactional-email", {
          body: {
            templateName: "organization-invite",
            recipientEmail: toEmail,
            idempotencyKey: `org-invite-${organization_id}-${toEmail.toLowerCase()}-${Date.now()}`,
            templateData: {
              organizationName: orgName,
              inviteUrl,
            },
          },
        });
        if (error) {
          console.error(`Failed to queue invite email for ${toEmail}:`, error);
        } else {
          console.log(`Invite email queued for ${toEmail}`, data);
        }
      } catch (err) {
        console.error(`Failed to queue invite email for ${toEmail}:`, (err as Error).message);
      }
    };

    // Check if user already exists
    const { data: { users } } = await adminClient.auth.admin.listUsers();
    const existingUser = users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      // Check if already a member
      const { data: existingMembership } = await adminClient
        .from("memberships")
        .select("id")
        .eq("user_id", existingUser.id)
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (existingMembership) {
        return new Response(JSON.stringify({ error: "already_member" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Add membership directly
      const { error: memberError } = await adminClient.from("memberships").insert({
        user_id: existingUser.id,
        organization_id,
        role,
        invited_by: caller.id,
      });

      if (memberError) {
        return new Response(JSON.stringify({ error: memberError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await sendInviteEmail(email);

      return new Response(JSON.stringify({ status: "added", email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Store pending invite
      const { error: inviteStoreError } = await adminClient
        .from("pending_invites")
        .upsert(
          { email: email.toLowerCase(), organization_id, role, invited_by: caller.id },
          { onConflict: "email,organization_id" }
        );

      if (inviteStoreError) {
        return new Response(JSON.stringify({ error: inviteStoreError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await sendInviteEmail(email);

      return new Response(JSON.stringify({ status: "invited", email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

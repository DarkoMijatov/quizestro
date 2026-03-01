import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { code, organization_id } = await req.json()
    if (!code || !organization_id) {
      return new Response(JSON.stringify({ error: 'Missing code or organization_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify user is owner of this org
    const { data: isOwner } = await supabaseAdmin.rpc('is_org_owner', {
      _user_id: user.id,
      _org_id: organization_id,
    })
    if (!isOwner) {
      return new Response(JSON.stringify({ error: 'Only organization owner can redeem gift codes' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find the gift code
    const { data: giftCode, error: codeError } = await supabaseAdmin
      .from('gift_codes')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .single()

    if (codeError || !giftCode) {
      return new Response(JSON.stringify({ error: 'Invalid gift code' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (giftCode.is_used) {
      return new Response(JSON.stringify({ error: 'This gift code has already been used' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Calculate override_until
    const overrideUntil = giftCode.duration_days
      ? new Date(Date.now() + giftCode.duration_days * 24 * 60 * 60 * 1000).toISOString()
      : null

    // Apply premium override to organization
    const { error: updateError } = await supabaseAdmin
      .from('organizations')
      .update({
        premium_override: true,
        premium_override_until: overrideUntil,
        premium_override_by: user.id,
        premium_override_reason: `Gift code: ${giftCode.code}`,
      })
      .eq('id', organization_id)

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Failed to apply gift code' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Mark code as used
    await supabaseAdmin
      .from('gift_codes')
      .update({
        is_used: true,
        used_by_org_id: organization_id,
        used_at: new Date().toISOString(),
      })
      .eq('id', giftCode.id)

    return new Response(JSON.stringify({
      success: true,
      duration_days: giftCode.duration_days,
      override_until: overrideUntil,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/**
 * POST /api/auth/signup
 * Body: { email, password, fullName, churchSlug }
 *
 * Creates the Supabase auth user, then immediately creates a church_membership
 * in pending or approved state based on the church's requiresApproval setting.
 */
export async function POST(req: NextRequest) {
  const { email, password, fullName, churchSlug } = await req.json()

  if (!email || !password || !fullName || !churchSlug) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = adminClient()

  // Look up the church
  const { data: church, error: churchErr } = await admin
    .from('churches')
    .select('id, requires_approval')
    .eq('slug', churchSlug)
    .single()

  if (churchErr || !church) {
    return Response.json({ error: 'Church not found' }, { status: 404 })
  }

  // Create the auth user
  const { data: authData, error: signUpErr } = await admin.auth.admin.createUser({
    email,
    password,
    user_metadata: { full_name: fullName, name: fullName },
    email_confirm: true, // auto-confirm so they can log in immediately
  })

  if (signUpErr || !authData.user) {
    return Response.json(
      { error: signUpErr?.message ?? 'Failed to create account' },
      { status: 400 },
    )
  }

  const userId = authData.user.id
  const status = church.requires_approval ? 'pending' : 'approved'

  // Create the membership
  const { error: memberErr } = await admin
    .from('church_memberships')
    .insert({
      user_id: userId,
      church_id: church.id,
      role: 'member',
      status,
      joined_via: 'invite_link',
    })

  if (memberErr) {
    // Roll back user creation if membership fails
    await admin.auth.admin.deleteUser(userId)
    return Response.json({ error: 'Failed to create membership' }, { status: 500 })
  }

  // Also create a user_profile for backward compatibility
  await admin.from('user_profiles').upsert({
    id: userId,
    role: 'group',
    group_id: null,
  }, { onConflict: 'id' })

  return Response.json({ status, churchSlug })
}

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'

/**
 * POST /api/invites/[token]/accept
 * Called after the user has signed in. Creates the church membership and marks the invite accepted.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Load the invite
  const { data: invite } = await admin
    .from('church_invites')
    .select('id, church_id, role, status, expires_at, email')
    .eq('token', token)
    .single()

  if (!invite) return Response.json({ error: 'Invite not found' }, { status: 404 })
  if (invite.status !== 'pending') return Response.json({ error: 'Invite already used or revoked' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) return Response.json({ error: 'Invite expired' }, { status: 410 })

  // Create the membership
  const { error: memberErr } = await admin
    .from('church_memberships')
    .upsert({
      user_id: user.id,
      church_id: invite.church_id,
      role: invite.role,
      status: 'approved',
      joined_via: 'email_invite',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,church_id' })

  if (memberErr) return Response.json({ error: memberErr.message }, { status: 500 })

  // Mark invite as accepted
  await admin
    .from('church_invites')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  // Ensure legacy user_profile
  await admin.from('user_profiles').upsert({
    id: user.id, role: 'group', group_id: null,
  }, { onConflict: 'id' })

  return Response.json({ ok: true })
}

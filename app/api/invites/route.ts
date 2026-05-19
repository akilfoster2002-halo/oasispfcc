import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function getRequestingAdmin(churchId: string) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = adminClient()
  const { data: m } = await admin
    .from('church_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('church_id', churchId)
    .eq('status', 'approved')
    .single()

  if (!m || !['admin', 'pastor', 'leader'].includes(m.role)) return null
  return { userId: user.id }
}

/**
 * GET /api/invites?churchId=xxx
 * Lists all invites for a church.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const churchId = searchParams.get('churchId')
  if (!churchId) return Response.json({ error: 'Missing churchId' }, { status: 400 })

  const requester = await getRequestingAdmin(churchId)
  if (!requester) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = adminClient()
  const { data: invites } = await supabase
    .from('church_invites')
    .select('id, email, role, status, created_at, expires_at, accepted_at')
    .eq('church_id', churchId)
    .order('created_at', { ascending: false })

  return Response.json({ invites: invites ?? [] })
}

/**
 * POST /api/invites
 * Body: { churchId, email, role }
 * Creates an invite record and sends the invite email via Supabase Auth.
 */
export async function POST(req: Request) {
  const { churchId, email, role = 'member' } = await req.json()

  if (!churchId || !email) {
    return Response.json({ error: 'Missing churchId or email' }, { status: 400 })
  }

  const requester = await getRequestingAdmin(churchId)
  if (!requester) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = adminClient()

  // Look up the church slug for the redirect URL
  const { data: church } = await supabase
    .from('churches')
    .select('id, slug, name')
    .eq('id', churchId)
    .single()

  if (!church) return Response.json({ error: 'Church not found' }, { status: 404 })

  // Check for duplicate active invite
  const { data: existingInvite } = await supabase
    .from('church_invites')
    .select('id, status')
    .eq('church_id', churchId)
    .eq('email', email)
    .single()

  let inviteToken: string

  if (existingInvite && existingInvite.status === 'pending') {
    // Re-use existing token (resend)
    const { data: inv } = await supabase
      .from('church_invites')
      .select('token')
      .eq('id', existingInvite.id)
      .single()
    inviteToken = inv!.token
    // Refresh expiry
    await supabase
      .from('church_invites')
      .update({ expires_at: new Date(Date.now() + 7 * 86400000).toISOString() })
      .eq('id', existingInvite.id)
  } else {
    // Create a new invite record (get the auto-generated token from DB)
    const { data: newInvite, error: inviteErr } = await supabase
      .from('church_invites')
      .insert({
        church_id: churchId,
        created_by: requester.userId,
        email,
        role,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
      .select('token')
      .single()

    if (inviteErr || !newInvite) {
      return Response.json({ error: inviteErr?.message ?? 'Failed to create invite' }, { status: 500 })
    }
    inviteToken = newInvite.token
  }

  // Determine the app URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const inviteUrl = `${appUrl}/invite/${inviteToken}`

  // Send the invite email via Supabase — redirects directly to the invite page.
  const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteUrl,
    data: {
      church_slug: church.slug,
      church_name: church.name,
      invite_token: inviteToken,
      role,
    },
  })

  if (inviteErr) {
    // User already has a Supabase account — return the invite URL for the admin to share
    if (inviteErr.message.toLowerCase().includes('already been registered') || inviteErr.message.toLowerCase().includes('already registered')) {
      return Response.json({ inviteToken, inviteUrl, emailSent: false }, { status: 201 })
    }
    return Response.json({ error: inviteErr.message }, { status: 500 })
  }

  return Response.json({ inviteToken, emailSent: true }, { status: 201 })
}

/**
 * DELETE /api/invites?inviteId=xxx&churchId=xxx
 * Revokes a pending invite.
 */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const inviteId = searchParams.get('inviteId')
  const churchId = searchParams.get('churchId')
  if (!inviteId || !churchId) return Response.json({ error: 'Missing params' }, { status: 400 })

  const requester = await getRequestingAdmin(churchId)
  if (!requester) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = adminClient()
  await supabase
    .from('church_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .eq('church_id', churchId)

  return Response.json({ ok: true })
}

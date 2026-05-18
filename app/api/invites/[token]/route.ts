import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

/** GET /api/invites/[token] — public endpoint so the invite page can load church info */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: invite } = await supabase
    .from('church_invites')
    .select('email, role, status, expires_at, church:churches(name, slug)')
    .eq('token', token)
    .single()

  if (!invite) {
    return Response.json({ error: 'Invite not found' }, { status: 404 })
  }
  if (invite.status === 'accepted') {
    return Response.json({ error: 'This invite has already been used' }, { status: 410 })
  }
  if (invite.status === 'revoked') {
    return Response.json({ error: 'This invite has been revoked' }, { status: 410 })
  }
  if (new Date(invite.expires_at) < new Date()) {
    return Response.json({ error: 'This invite has expired' }, { status: 410 })
  }

  return Response.json({ invite })
}

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
  const { data: membership } = await admin
    .from('church_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('church_id', churchId)
    .eq('status', 'approved')
    .single()

  if (!membership || !['admin', 'pastor'].includes(membership.role)) return null
  return { userId: user.id, role: membership.role }
}

/**
 * GET /api/admin/approvals?churchId=xxx
 * Returns all pending memberships for a church with user info.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const churchId = searchParams.get('churchId')
  if (!churchId) return Response.json({ error: 'Missing churchId' }, { status: 400 })

  const requester = await getRequestingAdmin(churchId)
  if (!requester) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = adminClient()

  const { data: memberships } = await supabase
    .from('church_memberships')
    .select('id, user_id, role, status, joined_via, created_at')
    .eq('church_id', churchId)
    .order('created_at', { ascending: true })

  if (!memberships?.length) return Response.json({ memberships: [] })

  // Fetch user metadata for display
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const userMap = new Map(users.map(u => [u.id, u]))

  const result = memberships.map(m => {
    const u = userMap.get(m.user_id)
    return {
      ...m,
      email: u?.email ?? '—',
      name: (u?.user_metadata?.full_name ?? u?.user_metadata?.name ?? '') as string,
    }
  })

  return Response.json({ memberships: result })
}

/**
 * PATCH /api/admin/approvals
 * Body: { membershipId, action: 'approve'|'reject'|'suspend', role?, churchId }
 */
export async function PATCH(req: Request) {
  const { membershipId, action, role, churchId } = await req.json()

  if (!membershipId || !action || !churchId) {
    return Response.json({ error: 'Missing fields' }, { status: 400 })
  }

  const requester = await getRequestingAdmin(churchId)
  if (!requester) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = adminClient()

  const statusMap: Record<string, string> = {
    approve: 'approved',
    reject: 'rejected',
    suspend: 'suspended',
  }

  const newStatus = statusMap[action]
  if (!newStatus) return Response.json({ error: 'Invalid action' }, { status: 400 })

  const update: Record<string, string> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }
  if (role && action === 'approve') update.role = role

  const { data, error } = await supabase
    .from('church_memberships')
    .update(update)
    .eq('id', membershipId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ membership: data })
}

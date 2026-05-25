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

async function getRequestingContext() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, group_id')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'master') return null

  const { data: membership } = await supabase
    .from('church_memberships')
    .select('church_id')
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .maybeSingle()

  return { profile, churchId: membership?.church_id ?? null }
}

/** GET /api/admin/users — list users for the requesting user's church only */
export async function GET() {
  const ctx = await getRequestingContext()
  if (!ctx || !ctx.churchId) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = adminClient()

  // Get all approved memberships for this church
  const { data: memberships } = await supabase
    .from('church_memberships')
    .select('user_id')
    .eq('church_id', ctx.churchId)
    .eq('status', 'approved')

  const churchUserIds = new Set((memberships ?? []).map((m: { user_id: string }) => m.user_id))
  if (churchUserIds.size === 0) return Response.json({ users: [], groups: [] })

  // Load all auth users and filter to this church's members
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 500 })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const churchUsers = users.filter(u => churchUserIds.has(u.id))

  // Load profiles for these users only
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, role, group_id')
    .in('id', [...churchUserIds])

  const profileMap = new Map((profiles ?? []).map((p: { id: string; role: string; group_id: string | null }) => [p.id, p]))

  // Load groups scoped to this church
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name')
    .eq('church_id', ctx.churchId)
    .order('name')

  const result = churchUsers.map(u => ({
    id: u.id,
    email: u.email,
    name: (u.user_metadata?.full_name ?? u.user_metadata?.name ?? '') as string,
    created_at: u.created_at,
    profile: profileMap.get(u.id) ?? null,
  }))

  return Response.json({ users: result, groups: groups ?? [] })
}

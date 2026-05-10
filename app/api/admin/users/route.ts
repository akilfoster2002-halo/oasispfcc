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

async function getRequestingProfile() {
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
  return profile
}

/** GET /api/admin/users — list all auth users with their profiles */
export async function GET() {
  const profile = await getRequestingProfile()
  if (!profile) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = adminClient()

  // List all auth users
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 200 })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Load all profiles
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, role, group_id')

  const profileMap = new Map((profiles ?? []).map((p: { id: string; role: string; group_id: string | null }) => [p.id, p]))

  // Load groups for display
  const { data: groups } = await supabase.from('groups').select('id, name').order('name')

  const result = users.map(u => ({
    id: u.id,
    email: u.email,
    name: (u.user_metadata?.full_name ?? u.user_metadata?.name ?? '') as string,
    created_at: u.created_at,
    profile: profileMap.get(u.id) ?? null,
  }))

  return Response.json({ users: result, groups: groups ?? [] })
}

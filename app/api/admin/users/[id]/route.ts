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

async function getRequesterChurch(): Promise<{ churchId: string } | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'master') return null
  const { data: membership } = await supabase
    .from('church_memberships').select('church_id')
    .eq('user_id', user.id).eq('status', 'approved').maybeSingle()
  return membership?.church_id ? { churchId: membership.church_id } : null
}

/** PATCH /api/admin/users/[id] — upsert a user's profile (own church only) */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getRequesterChurch()
  if (!ctx) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const supabase = adminClient()

  // Verify the target user belongs to the same church
  const { data: targetMembership } = await supabase
    .from('church_memberships')
    .select('user_id')
    .eq('user_id', id)
    .eq('church_id', ctx.churchId)
    .eq('status', 'approved')
    .maybeSingle()

  if (!targetMembership) return Response.json({ error: 'User not in your church' }, { status: 403 })

  const body = await req.json() as { role?: string; group_id?: string | null }
  const { error } = await supabase
    .from('user_profiles')
    .upsert({ id, role: body.role ?? 'group', group_id: body.group_id ?? null })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

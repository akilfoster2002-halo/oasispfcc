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

async function getRequestingUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/** GET /api/memberships — returns all church memberships for the logged-in user */
export async function GET() {
  const user = await getRequestingUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = adminClient()
  const { data: memberships } = await supabase
    .from('church_memberships')
    .select('*, church:churches(id, name, slug, logo_url, requires_approval)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return Response.json({ memberships: memberships ?? [] })
}

/**
 * POST /api/memberships — add the current user to a church (OAuth join flow)
 * Body: { churchSlug }
 */
export async function POST(req: Request) {
  const user = await getRequestingUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { churchSlug } = await req.json()
  if (!churchSlug) return Response.json({ error: 'Missing churchSlug' }, { status: 400 })

  const supabase = adminClient()

  const { data: church } = await supabase
    .from('churches')
    .select('id, requires_approval')
    .eq('slug', churchSlug)
    .single()

  if (!church) return Response.json({ error: 'Church not found' }, { status: 404 })

  const status = church.requires_approval ? 'pending' : 'approved'

  const { data: membership, error } = await supabase
    .from('church_memberships')
    .upsert({
      user_id: user.id,
      church_id: church.id,
      role: 'member',
      status,
      joined_via: 'invite_link',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,church_id' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ membership, status, churchSlug })
}

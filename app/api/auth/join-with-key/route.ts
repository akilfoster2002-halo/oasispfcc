import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/** POST /api/auth/join-with-key — authenticated user joins a church using its access key */
export async function POST(req: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const { key } = await req.json()
  if (!key) return Response.json({ error: 'Missing key' }, { status: 400 })

  const admin = adminClient()

  // Find the church with this key (must not be expired)
  const { data: church } = await admin
    .from('churches')
    .select('id, slug, name, access_key_expires_at')
    .eq('access_key', key.replace(/\s/g, '').toUpperCase())
    .single()

  if (!church) return Response.json({ error: 'Invalid access key' }, { status: 400 })

  if (!church.access_key_expires_at || new Date(church.access_key_expires_at) <= new Date()) {
    return Response.json({ error: 'This access key has expired. Ask your church admin for the current key.' }, { status: 400 })
  }

  // Check if already a member
  const { data: existing } = await admin
    .from('church_memberships')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('church_id', church.id)
    .single()

  if (existing) {
    if (existing.status === 'approved') {
      return Response.json({ slug: church.slug, alreadyMember: true })
    }
    // Re-approve if pending/rejected
    await admin
      .from('church_memberships')
      .update({ status: 'approved' })
      .eq('id', existing.id)
    return Response.json({ slug: church.slug })
  }

  // Create new approved membership
  await admin.from('church_memberships').insert({
    user_id: user.id,
    church_id: church.id,
    role: 'member',
    status: 'approved',
    joined_via: 'access_key',
  })

  return Response.json({ slug: church.slug })
}

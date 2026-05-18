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

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * POST /api/churches
 * Body: { name, slug }
 * Creates the church and makes the requesting user an admin.
 */
export async function POST(req: Request) {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, slug } = await req.json()

  if (!name?.trim() || !slug?.trim()) {
    return Response.json({ error: 'Name and ID are required' }, { status: 400 })
  }

  if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
    return Response.json({ error: 'Invalid church ID format' }, { status: 400 })
  }

  const supabase = adminClient()

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from('churches')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existing) {
    return Response.json({ error: 'This church ID is already taken' }, { status: 409 })
  }

  // Create the church
  const { data: church, error: churchErr } = await supabase
    .from('churches')
    .insert({ name: name.trim(), slug, requires_approval: false })
    .select()
    .single()

  if (churchErr || !church) {
    return Response.json({ error: churchErr?.message ?? 'Failed to create church' }, { status: 500 })
  }

  // Make the creator an admin with approved status
  const { error: memberErr } = await supabase
    .from('church_memberships')
    .insert({
      user_id: user.id,
      church_id: church.id,
      role: 'admin',
      status: 'approved',
      joined_via: 'created',
    })

  if (memberErr) {
    await supabase.from('churches').delete().eq('id', church.id)
    return Response.json({ error: 'Failed to set up admin membership' }, { status: 500 })
  }

  // Ensure legacy user_profile exists
  await supabase.from('user_profiles').upsert({
    id: user.id, role: 'master', group_id: null,
  }, { onConflict: 'id' })

  return Response.json({ church }, { status: 201 })
}

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
    .insert({ name: name.trim(), slug })
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
      role: 'master',
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

  // Seed the Cell Report preset form for this church
  await supabase.from('forms').insert({
    church_id: church.id,
    name: 'Cell Report',
    description: 'Weekly cell group meeting report',
    is_preset: true,
    fields: [
      { id: 'leader_name',        type: 'text',     label: 'Leader Name',              required: true,  placeholder: 'Full name of cell leader' },
      { id: 'cell_name',          type: 'text',     label: 'Cell Group Name',          required: true,  placeholder: 'e.g. Eagles Cell' },
      { id: 'meeting_type',       type: 'radio',    label: 'Meeting Type',             required: true,  options: ['In-Person', 'Online', 'Hybrid'] },
      { id: 'total_attendance',   type: 'number',   label: 'Total Attendance',         required: true  },
      { id: 'first_timers',       type: 'number',   label: 'First Timers',             required: false },
      { id: 'first_timer_details',type: 'textarea', label: 'First Timer Details',      required: false, placeholder: 'Names, contacts, notes…' },
      { id: 'soul_won',           type: 'number',   label: 'Souls Won',                required: false },
      { id: 'fs_enrolled',        type: 'number',   label: 'Foundation School Enrolled', required: false },
      { id: 'substantiations',    type: 'number',   label: 'Substantiations',          required: false },
      { id: 'prayer_points',      type: 'textarea', label: 'Prayer Points',            required: false, placeholder: 'Key prayer points from the meeting…' },
      { id: 'additional_notes',   type: 'textarea', label: 'Additional Notes',         required: false, placeholder: 'Anything else to report…' },
    ],
  })

  return Response.json({ church }, { status: 201 })
}

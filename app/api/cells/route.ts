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

async function getRequestingMember(churchId: string) {
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

/** GET /api/cells?churchId= */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const churchId = searchParams.get('churchId')
  if (!churchId) return Response.json({ error: 'Missing churchId' }, { status: 400 })

  const member = await getRequestingMember(churchId)
  if (!member) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()
  const { data, error } = await admin
    .from('cells')
    .select('*')
    .eq('church_id', churchId)
    .eq('is_active', true)
    .order('name')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ cells: data })
}

/** POST /api/cells — create a cell */
export async function POST(req: Request) {
  const body = await req.json()
  const { churchId, name, groupId, leaderId, leaderName, meetingDay, meetingTime, location, color } = body
  if (!churchId || !name) return Response.json({ error: 'Missing required fields' }, { status: 400 })

  const member = await getRequestingMember(churchId)
  if (!member) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()
  const { data, error } = await admin
    .from('cells')
    .insert({
      church_id: churchId,
      name,
      group_id: groupId ?? null,
      leader_id: leaderId ?? null,
      leader_name: leaderName ?? null,
      meeting_day: meetingDay ?? null,
      meeting_time: meetingTime ?? null,
      location: location ?? null,
      color: color ?? '#6366f1',
      is_active: true,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ cell: data }, { status: 201 })
}

/** PATCH /api/cells?id= — update a cell */
export async function PATCH(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const body = await req.json()
  const { churchId, ...updates } = body
  if (!churchId) return Response.json({ error: 'Missing churchId' }, { status: 400 })

  const member = await getRequestingMember(churchId)
  if (!member) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed: Record<string, unknown> = {}
  if ('name' in updates) allowed.name = updates.name
  if ('groupId' in updates) allowed.group_id = updates.groupId
  if ('leaderId' in updates) allowed.leader_id = updates.leaderId
  if ('leaderName' in updates) allowed.leader_name = updates.leaderName
  if ('meetingDay' in updates) allowed.meeting_day = updates.meetingDay
  if ('meetingTime' in updates) allowed.meeting_time = updates.meetingTime
  if ('location' in updates) allowed.location = updates.location
  if ('color' in updates) allowed.color = updates.color
  if ('isActive' in updates) allowed.is_active = updates.isActive

  const admin = adminClient()
  const { data, error } = await admin
    .from('cells')
    .update(allowed)
    .eq('id', id)
    .eq('church_id', churchId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ cell: data })
}

/** DELETE /api/cells?id=&churchId= */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const churchId = searchParams.get('churchId')
  if (!id || !churchId) return Response.json({ error: 'Missing params' }, { status: 400 })

  const member = await getRequestingMember(churchId)
  if (!member) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()
  const { error } = await admin
    .from('cells')
    .update({ is_active: false })
    .eq('id', id)
    .eq('church_id', churchId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}

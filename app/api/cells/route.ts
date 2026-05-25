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

async function getApprovedMember(churchId: string) {
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

  if (!m) return null
  return { userId: user.id, memberRole: m.role }
}

async function getEditor(churchId: string) {
  const member = await getApprovedMember(churchId)
  if (!member) return null

  const admin = adminClient()
  const { data: profile } = await admin
    .from('user_profiles')
    .select('role')
    .eq('id', member.userId)
    .single()

  const isMaster = profile?.role === 'master'
  if (!isMaster && !['admin', 'pastor', 'leader'].includes(member.memberRole)) return null
  return member
}

/** GET /api/cells?churchId= OR ?slug= */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  let churchId = searchParams.get('churchId')

  if (!churchId) {
    const slug = searchParams.get('slug')
    if (!slug) return Response.json({ error: 'Missing churchId or slug' }, { status: 400 })
    const { data: ch } = await adminClient().from('churches').select('id').eq('slug', slug).single()
    if (!ch) return Response.json({ error: 'Church not found' }, { status: 404 })
    churchId = ch.id as string
  }

  const member = await getApprovedMember(churchId as string)
  if (!member) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()
  const { data: cellsData, error } = await admin
    .from('cells')
    .select('*')
    .eq('church_id', churchId)
    .eq('is_active', true)
    .order('name')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const groupIds = [...new Set((cellsData ?? []).map((c: { group_id: string | null }) => c.group_id).filter(Boolean))]
  const { data: groupsData } = groupIds.length
    ? await admin.from('groups').select('id, name').in('id', groupIds)
    : { data: [] }

  const groupMap = new Map((groupsData ?? []).map((g: { id: string; name: string }) => [g.id, g.name]))
  const cells = (cellsData ?? []).map((cell: Record<string, unknown>) => ({
    ...cell,
    group_name: cell.group_id ? (groupMap.get(cell.group_id as string) ?? null) : null,
  }))

  return Response.json({ cells })
}

/** POST /api/cells — create a cell */
export async function POST(req: Request) {
  const body = await req.json()
  const { churchId, name, groupId, leaderId, leaderName, meetingDay, meetingTime, location, color } = body
  if (!churchId || !name) return Response.json({ error: 'Missing required fields' }, { status: 400 })

  const member = await getEditor(churchId)
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
      color: color ?? '#A88A35',
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

  const member = await getEditor(churchId)
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

  const member = await getEditor(churchId)
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

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

/** GET /api/cells/overrides?cellId= */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const cellId = searchParams.get('cellId')
  const churchId = searchParams.get('churchId')
  if (!cellId || !churchId) return Response.json({ error: 'Missing params' }, { status: 400 })

  const member = await getRequestingMember(churchId)
  if (!member) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()
  const { data, error } = await admin
    .from('cell_meeting_overrides')
    .select('*')
    .eq('cell_id', cellId)
    .order('original_date')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ overrides: data })
}

/** POST /api/cells/overrides — upsert a date override */
export async function POST(req: Request) {
  const body = await req.json()
  const { churchId, cellId, originalDate, newDate, startTime, endTime, notes } = body
  if (!churchId || !cellId || !originalDate || !newDate)
    return Response.json({ error: 'Missing required fields' }, { status: 400 })

  const member = await getRequestingMember(churchId)
  if (!member) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()
  const { data, error } = await admin
    .from('cell_meeting_overrides')
    .upsert({
      cell_id: cellId,
      original_date: originalDate,
      new_date: newDate,
      start_time: startTime ?? null,
      end_time: endTime ?? null,
      notes: notes ?? null,
    }, { onConflict: 'cell_id,original_date' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ override: data }, { status: 201 })
}

/** DELETE /api/cells/overrides?id=&churchId= */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const churchId = searchParams.get('churchId')
  if (!id || !churchId) return Response.json({ error: 'Missing params' }, { status: 400 })

  const member = await getRequestingMember(churchId)
  if (!member) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()
  const { error } = await admin
    .from('cell_meeting_overrides')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}

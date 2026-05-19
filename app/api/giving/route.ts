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

/** GET /api/giving?churchId=&personId=&fund=&from=&to=&limit= */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const churchId = searchParams.get('churchId')
  if (!churchId) return Response.json({ error: 'Missing churchId' }, { status: 400 })

  const requester = await getRequestingMember(churchId)
  if (!requester) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = adminClient()
  let query = supabase
    .from('giving')
    .select('*')
    .eq('church_id', churchId)
    .order('given_at', { ascending: false })

  const personId = searchParams.get('personId')
  if (personId) query = query.eq('person_id', personId)

  const fund = searchParams.get('fund')
  if (fund) query = query.eq('fund', fund)

  const from = searchParams.get('from')
  if (from) query = query.gte('given_at', from)

  const to = searchParams.get('to')
  if (to) query = query.lte('given_at', to)

  const limit = parseInt(searchParams.get('limit') ?? '200')
  query = query.limit(limit)

  const { data: gifts, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ gifts: gifts ?? [] })
}

/** POST /api/giving — record a gift */
export async function POST(req: Request) {
  const body = await req.json()
  const { churchId, personId, personName, amount, fund = 'General', method = 'cash', givenAt, notes } = body

  if (!churchId || !personName || !amount) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const requester = await getRequestingMember(churchId)
  if (!requester) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = adminClient()
  const { data: gift, error } = await supabase
    .from('giving')
    .insert({
      church_id: churchId,
      person_id: personId ?? null,
      person_name: personName,
      amount: parseFloat(amount),
      fund,
      method,
      given_at: givenAt ?? new Date().toISOString().slice(0, 10),
      notes: notes ?? null,
      recorded_by: requester.userId,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ gift }, { status: 201 })
}

/** DELETE /api/giving?id=&churchId= */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const churchId = searchParams.get('churchId')
  if (!id || !churchId) return Response.json({ error: 'Missing params' }, { status: 400 })

  const requester = await getRequestingMember(churchId)
  if (!requester) return Response.json({ error: 'Forbidden' }, { status: 403 })

  await adminClient().from('giving').delete().eq('id', id).eq('church_id', churchId)
  return Response.json({ ok: true })
}

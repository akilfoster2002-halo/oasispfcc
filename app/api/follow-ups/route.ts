import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// GET /api/follow-ups?church_id=&status=pending
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const church_id = searchParams.get('church_id')
  const status    = searchParams.get('status') ?? 'pending'
  if (!church_id) return Response.json({ error: 'church_id required' }, { status: 400 })

  const { data, error } = await db()
    .from('follow_ups')
    .select('*')
    .eq('church_id', church_id)
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

// POST /api/follow-ups  — called automatically when a first-timer checks in
export async function POST(req: Request) {
  const body = await req.json()
  const { church_id, person_id, person_name, phone, event_id, event_name, event_date, message } = body

  if (!church_id || !person_id || !event_id || !message) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Avoid duplicate drafts for the same person + event
  const { data: existing } = await db()
    .from('follow_ups')
    .select('id')
    .eq('person_id', person_id)
    .eq('event_id', event_id)
    .single()

  if (existing) return Response.json({ skipped: true })

  const { data, error } = await db()
    .from('follow_ups')
    .insert({ church_id, person_id, person_name, phone, event_id, event_name, event_date, message })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const sb = adminClient()

  const { data, error } = await sb
    .from('events')
    .select('*, groups(id, name)')
    .eq('id', id)
    .single()

  if (error || !data) return Response.json({ error: 'Event not found' }, { status: 404 })
  return Response.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const {
    name,
    description,
    location,
    service_type,
    group_id,
    cell_id,
    all_day,
    event_date,
    start_time,
    end_time,
    first_timers,
    soul_won,
    fs_enrolled,
    substantiations,
  } = body

  const update: Record<string, unknown> = {}
  if (name        !== undefined) update.name         = String(name).trim()
  if (description !== undefined) update.description  = description || null
  if (location    !== undefined) update.location     = location    || null
  if (service_type !== undefined) update.service_type = service_type
  if (group_id    !== undefined) update.group_id     = group_id    || null
  if (cell_id     !== undefined) update.cell_id      = cell_id     || null
  if (all_day     !== undefined) update.all_day      = all_day

  if (event_date !== undefined) {
    update.event_date = event_date
    const date = event_date as string
    update.event_datetime     = (!all_day && start_time) ? `${date}T${start_time}:00` : null
    update.event_end_datetime = (!all_day && end_time)   ? `${date}T${end_time}:00`   : null
  }

  if (first_timers    !== undefined) update.first_timers    = Number(first_timers)
  if (soul_won        !== undefined) update.soul_won        = Number(soul_won)
  if (fs_enrolled     !== undefined) update.fs_enrolled     = Number(fs_enrolled)
  if (substantiations !== undefined) update.substantiations = Number(substantiations)

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 })
  }

  const sb = adminClient()
  const { data, error } = await sb
    .from('events')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

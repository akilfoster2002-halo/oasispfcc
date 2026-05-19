import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { generateOccurrences, RecurrenceRule } from '@/lib/recurrence'

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

function makeDatetime(dateStr: string, time: string | null, allDay: boolean): string | null {
  if (allDay || !time) return null
  return `${dateStr}T${time}:00`
}

export async function POST(req: Request) {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    church_id,
    name,
    description,
    location,
    service_type = 'other',
    group_id,
    cell_id,
    all_day = false,
    event_date,
    start_time,
    end_time,
    recurrence,
  }: {
    church_id: string
    name: string
    description?: string
    location?: string
    service_type?: string
    group_id?: string
    cell_id?: string
    all_day?: boolean
    event_date: string
    start_time?: string
    end_time?: string
    recurrence?: RecurrenceRule
  } = body

  if (!church_id || !name?.trim() || !event_date) {
    return Response.json({ error: 'church_id, name, and event_date are required' }, { status: 400 })
  }

  const rule: RecurrenceRule = recurrence ?? {
    type: 'none', interval: 1, days: [], monthlyType: 'day_of_month',
    endType: 'never', endDate: '', endCount: 1,
  }

  const dates = generateOccurrences(event_date, rule)
  if (dates.length === 0) {
    return Response.json({ error: 'Recurrence rule produced no dates' }, { status: 400 })
  }

  const sb = adminClient()

  // Create series record for recurring events
  let series_id: string | null = null
  if (rule.type !== 'none') {
    const { data: series, error: seriesErr } = await sb
      .from('event_series')
      .insert({
        church_id,
        name: name.trim(),
        description: description || null,
        location: location || null,
        service_type,
        group_id: group_id || null,
        cell_id: cell_id || null,
        all_day,
        start_time: start_time || null,
        end_time: end_time || null,
        recurrence_type: rule.type,
        recurrence_interval: rule.interval,
        recurrence_days: rule.days,
        monthly_type: rule.monthlyType,
        end_type: rule.endType,
        end_date: rule.endType === 'on_date' ? rule.endDate : null,
        end_count: rule.endType === 'after_count' ? rule.endCount : null,
      })
      .select('id')
      .single()

    if (seriesErr || !series) {
      return Response.json({ error: seriesErr?.message ?? 'Failed to create series' }, { status: 500 })
    }
    series_id = series.id
  }

  // Bulk-insert all event instances
  const rows = dates.map(dateStr => ({
    church_id,
    series_id,
    name: name.trim(),
    description: description || null,
    location: location || null,
    service_type,
    group_id: group_id || null,
    cell_id: cell_id || null,
    all_day,
    event_date: dateStr,
    event_datetime: makeDatetime(dateStr, start_time ?? null, all_day),
    event_end_datetime: makeDatetime(dateStr, end_time ?? null, all_day),
  }))

  const { data, error } = await sb
    .from('events')
    .insert(rows)
    .select('id, event_date')
    .order('event_date')

  if (error) {
    if (series_id) await sb.from('event_series').delete().eq('id', series_id)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(
    {
      count: data?.length ?? 0,
      first_id: data?.[0]?.id ?? null,
      series_id,
    },
    { status: 201 },
  )
}

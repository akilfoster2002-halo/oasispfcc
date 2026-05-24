import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { generateOccurrences, type RecurrenceRule } from '@/lib/recurrence'

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
    .select('*, groups(id, name), event_series(recurrence_type, recurrence_interval, recurrence_days, monthly_type, end_type, end_date, end_count)')
    .eq('id', id)
    .single()

  if (error || !data) return Response.json({ error: 'Event not found' }, { status: 404 })

  // Reconstruct recurrence_rule from event_series so the edit form can pre-populate
  let recurrence_rule: RecurrenceRule | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const series = (data as any).event_series
  if (series) {
    recurrence_rule = {
      type:        series.recurrence_type      ?? 'none',
      interval:    series.recurrence_interval  ?? 1,
      days:        series.recurrence_days      ?? [],
      monthlyType: series.monthly_type         ?? 'day_of_month',
      endType:     series.end_type             ?? 'never',
      endDate:     series.end_date             ?? '',
      endCount:    series.end_count            ?? 10,
    }
  }

  return Response.json({ ...data, recurrence_rule })
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
    recurrence,
  } = body

  const update: Record<string, unknown> = {}
  if (name         !== undefined) update.name         = String(name).trim()
  if (description  !== undefined) update.description  = description  || null
  if (location     !== undefined) update.location     = location     || null
  if (service_type !== undefined) update.service_type = service_type
  if (group_id     !== undefined) update.group_id     = group_id     || null
  if (cell_id      !== undefined) update.cell_id      = cell_id      || null
  if (all_day      !== undefined) update.all_day      = all_day

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

  const sb = adminClient()

  // ── Handle recurrence: create/update event_series + generate future events ──
  if (recurrence && (recurrence as RecurrenceRule).type !== 'none') {
    const rule = recurrence as RecurrenceRule

    const { data: currentEvent, error: fetchErr } = await sb
      .from('events')
      .select('church_id, series_id, event_date')
      .eq('id', id)
      .single()

    if (fetchErr || !currentEvent) {
      return Response.json({ error: 'Event not found' }, { status: 404 })
    }

    const churchId         = currentEvent.church_id as string
    const effectiveName    = (update.name         ?? name         ?? '')    as string
    const effectiveSvcType = (update.service_type ?? service_type ?? 'other') as string
    const effectiveGroupId = (update.group_id     !== undefined ? update.group_id : (group_id ?? null)) as string | null
    const effectiveCellId  = (update.cell_id      !== undefined ? update.cell_id  : (cell_id  ?? null)) as string | null
    const effectiveAllDay  = (update.all_day      !== undefined ? update.all_day  : (all_day  ?? false)) as boolean
    const effectiveDate    = (update.event_date   ?? event_date  ?? currentEvent.event_date) as string
    const effectiveStart   = (!effectiveAllDay && start_time) ? (start_time as string) : null
    const effectiveEnd     = (!effectiveAllDay && end_time)   ? (end_time   as string) : null

    const seriesPayload = {
      church_id:           churchId,
      name:                effectiveName,
      service_type:        effectiveSvcType,
      group_id:            effectiveGroupId,
      cell_id:             effectiveCellId,
      all_day:             effectiveAllDay,
      start_time:          effectiveStart,
      end_time:            effectiveEnd,
      recurrence_type:     rule.type,
      recurrence_interval: rule.interval,
      recurrence_days:     rule.days.length > 0 ? rule.days : null,
      monthly_type:        rule.type === 'monthly' ? rule.monthlyType : null,
      end_type:            rule.endType,
      end_date:            rule.endType === 'on_date'     ? rule.endDate  : null,
      end_count:           rule.endType === 'after_count' ? rule.endCount : null,
    }

    let seriesId: string

    if (currentEvent.series_id) {
      const { error: upErr } = await sb
        .from('event_series').update(seriesPayload).eq('id', currentEvent.series_id)
      if (upErr) return Response.json({ error: upErr.message }, { status: 500 })
      seriesId = currentEvent.series_id as string
    } else {
      const { data: newSeries, error: insErr } = await sb
        .from('event_series').insert(seriesPayload).select('id').single()
      if (insErr || !newSeries) {
        return Response.json({ error: insErr?.message ?? 'Failed to create series' }, { status: 500 })
      }
      seriesId = (newSeries as { id: string }).id
    }

    update.series_id = seriesId

    // Generate all dates and insert those not already in the series
    const allDates    = generateOccurrences(effectiveDate, rule)
    const today       = new Date().toISOString().slice(0, 10)
    const futureDates = allDates.filter(d => d >= today && d !== effectiveDate)

    if (futureDates.length > 0) {
      const { data: existing } = await sb
        .from('events').select('event_date').eq('series_id', seriesId)
      const existingSet = new Set(
        (existing ?? []).map((e: { event_date: string }) => e.event_date),
      )

      const toInsert = futureDates
        .filter(d => !existingSet.has(d))
        .map(d => ({
          church_id:          churchId,
          name:               effectiveName,
          service_type:       effectiveSvcType,
          group_id:           effectiveGroupId,
          cell_id:            effectiveCellId,
          all_day:            effectiveAllDay,
          event_date:         d,
          event_datetime:     effectiveStart ? `${d}T${effectiveStart}:00` : null,
          event_end_datetime: effectiveEnd   ? `${d}T${effectiveEnd}:00`   : null,
          series_id:          seriesId,
          first_timers:       0,
          soul_won:           0,
          fs_enrolled:        0,
          substantiations:    0,
        }))

      if (toInsert.length > 0) {
        const { error: bulkErr } = await sb.from('events').insert(toInsert)
        if (bulkErr) return Response.json({ error: bulkErr.message }, { status: 500 })
      }
    }
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('events')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

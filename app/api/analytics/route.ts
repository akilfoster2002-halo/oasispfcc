import { getSupabaseServer } from '@/lib/supabase-server'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekStart(dateStr: string): string {
  const d   = new Date(dateStr + 'T12:00:00Z')
  const dow = d.getUTCDay()
  const sun = new Date(d.getTime() - dow * 86_400_000)
  const y   = sun.getUTCFullYear()
  const mo  = String(sun.getUTCMonth() + 1).padStart(2, '0')
  const dy  = String(sun.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${dy}`
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const now = new Date()
    const defaultFrom = new Date(now)
    defaultFrom.setFullYear(now.getFullYear() - 1)

    const from = searchParams.get('from') ?? defaultFrom.toISOString().split('T')[0]
    const to   = searchParams.get('to')   ?? now.toISOString().split('T')[0]

    const supabase = getSupabaseServer()

    // ── 1. Meetings in range ───────────────────────────────────────────────
    const { data: meetings, error: mErr } = await supabase
      .from('meetings')
      .select('id, date, service_type, title')
      .gte('date', from)
      .lte('date', to + 'T23:59:59')
      .order('date')

    if (mErr) return Response.json({ error: mErr.message }, { status: 500 })

    const meetingIds = (meetings ?? []).map(m => m.id as string)

    const empty = {
      kpis: { totalServices: 0, totalAttendances: 0, uniqueAttendees: 0, avgPerService: 0, growthRate: 0 },
      timeline: [], serviceBreakdown: [],
      newVsReturning: { new: 0, returning: 0 },
      topAttendees: [], distribution: [], monthlyTrends: [],
      cellBreakdown: [],
    }
    if (meetingIds.length === 0) return Response.json(empty)

    // ── 2. Attendance in range (batched to avoid URL length limits) ────────
    type AttRow = {
      meeting_id: string
      person_id:  string
      people: { id: string; first_name: string | null; last_name: string | null; name: string | null } | null
    }

    const attBatches = await Promise.all(
      chunk(meetingIds, 80).map(ids =>
        supabase
          .from('attendance')
          .select('meeting_id, person_id, people(id, first_name, last_name, name)')
          .in('meeting_id', ids)
          .eq('present', true)
          .limit(10000)
      )
    )
    const attendance: AttRow[] = attBatches.flatMap(r => (r.data ?? []) as unknown as AttRow[])
    const attErr = attBatches.find(r => r.error)?.error
    if (attErr) return Response.json({ error: attErr.message }, { status: 500 })

    // ── 3. Prior meetings (new vs returning) ───────────────────────────────
    const { data: priorMeetings } = await supabase
      .from('meetings')
      .select('id')
      .lt('date', from)

    const priorMeetingIds = (priorMeetings ?? []).map(m => m.id as string)
    let priorPersonIds = new Set<string>()

    if (priorMeetingIds.length > 0) {
      const priorBatches = await Promise.all(
        chunk(priorMeetingIds, 80).map(ids =>
          supabase
            .from('attendance')
            .select('person_id')
            .in('meeting_id', ids)
            .eq('present', true)
            .limit(5000)
        )
      )
      priorPersonIds = new Set(
        priorBatches.flatMap(r => (r.data ?? []).map((a: { person_id: string }) => a.person_id))
      )
    }

    // ── Build lookup maps ──────────────────────────────────────────────────
    type MeetingRow = { id: string; date: string; service_type: string | null; title: string | null }
    const meetingMap = new Map<string, MeetingRow>(
      (meetings ?? []).map(m => [m.id as string, m as MeetingRow])
    )

    type PersonRecord = { name: string; first_name: string; last_name: string; count: number }
    const personMap = new Map<string, PersonRecord>()

    type WeekEntry = { total: number; sunday_inperson: number; sunday_online: number; midweek: number; cell: number }
    const weeklyMap = new Map<string, WeekEntry>()

    const serviceMap = new Map<string, { count: number; meetingIds: Set<string> }>()
    const cellMap    = new Map<string, { count: number; meetingIds: Set<string> }>()

    for (const row of attendance) {
      const meeting = meetingMap.get(row.meeting_id)
      if (!meeting) continue

      const dateStr  = meeting.date.substring(0, 10)
      const weekKey  = getWeekStart(dateStr)
      const svc      = meeting.service_type ?? 'unknown'

      // Weekly timeline
      const w = weeklyMap.get(weekKey) ?? { total: 0, sunday_inperson: 0, sunday_online: 0, midweek: 0, cell: 0 }
      w.total++
      if      (svc === 'sunday_inperson') w.sunday_inperson++
      else if (svc === 'sunday_online')   w.sunday_online++
      else if (svc === 'midweek')         w.midweek++
      else if (svc === 'cell')            w.cell++
      weeklyMap.set(weekKey, w)

      // Service breakdown
      const s = serviceMap.get(svc) ?? { count: 0, meetingIds: new Set<string>() }
      s.count++
      s.meetingIds.add(row.meeting_id)
      serviceMap.set(svc, s)

      // Cell breakdown
      if (svc === 'cell' && meeting.title) {
        const c = cellMap.get(meeting.title) ?? { count: 0, meetingIds: new Set<string>() }
        c.count++
        c.meetingIds.add(row.meeting_id)
        cellMap.set(meeting.title, c)
      }

      // Per-person
      if (row.people) {
        const p = row.people
        const rec = personMap.get(row.person_id) ?? {
          name:       p.name ?? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
          first_name: p.first_name ?? '',
          last_name:  p.last_name  ?? '',
          count: 0,
        }
        rec.count++
        personMap.set(row.person_id, rec)
      }
    }

    // ── Weekly timeline (sorted) ───────────────────────────────────────────
    const timeline = Array.from(weeklyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, d]) => ({ week, ...d }))

    // ── Service breakdown ──────────────────────────────────────────────────
    const SVC_LABELS: Record<string, string> = {
      sunday_inperson: 'Sunday In-Person',
      sunday_online:   'Sunday Online',
      midweek:         'Midweek Service',
      cell:            'Cell Meetings',
      unknown:         'Unknown',
    }
    const serviceBreakdown = Array.from(serviceMap.entries())
      .map(([type, d]) => ({
        type,
        label:    SVC_LABELS[type] ?? type,
        count:    d.count,
        sessions: d.meetingIds.size,
        avg:      Math.round(d.count / d.meetingIds.size),
      }))
      .sort((a, b) => b.count - a.count)

    // ── Cell breakdown (top 10 cells by attendance) ────────────────────────
    const cellBreakdown = Array.from(cellMap.entries())
      .map(([cell, d]) => ({
        cell,
        count:    d.count,
        sessions: d.meetingIds.size,
        avg:      Math.round(d.count / d.meetingIds.size),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // ── New vs returning ───────────────────────────────────────────────────
    let newCount = 0, returningCount = 0
    for (const id of personMap.keys()) {
      if (priorPersonIds.has(id)) returningCount++
      else newCount++
    }

    // ── Top 15 attendees ───────────────────────────────────────────────────
    const topAttendees = Array.from(personMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)

    // ── Attendance distribution (bucketed) ────────────────────────────────
    const BUCKETS = [
      { label: '1',     min: 1,  max: 1 },
      { label: '2–3',   min: 2,  max: 3 },
      { label: '4–6',   min: 4,  max: 6 },
      { label: '7–10',  min: 7,  max: 10 },
      { label: '11–20', min: 11, max: 20 },
      { label: '21+',   min: 21, max: Infinity },
    ]
    const personCounts = Array.from(personMap.values()).map(p => p.count)
    const distribution = BUCKETS
      .map(b => ({ bucket: b.label, people: personCounts.filter(c => c >= b.min && c <= b.max).length }))
      .filter(b => b.people > 0)

    // ── Monthly trends ─────────────────────────────────────────────────────
    const monthlyMap = new Map<string, number>()
    for (const e of timeline) {
      const mo = e.week.substring(0, 7)
      monthlyMap.set(mo, (monthlyMap.get(mo) ?? 0) + e.total)
    }
    const moEntries = Array.from(monthlyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    const monthlyTrends = moEntries.map(([mo, total], i) => {
      const prior  = i > 0 ? moEntries[i - 1][1] : null
      const growth = prior && prior > 0 ? Math.round(((total - prior) / prior) * 100) : 0
      const [y, m] = mo.split('-')
      const label  = new Date(Number(y), Number(m) - 1, 1)
        .toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      return { month: label, total, growth }
    })

    // ── KPIs ───────────────────────────────────────────────────────────────
    const totalAttendances = attendance.length
    const totalServices    = meetingIds.length
    const uniqueAttendees  = personMap.size
    const avgPerService    = totalServices > 0 ? Math.round(totalAttendances / totalServices) : 0

    const todayStr = now.toISOString().split('T')[0]
    const d28 = new Date(now); d28.setDate(now.getDate() - 28)
    const d56 = new Date(now); d56.setDate(now.getDate() - 56)
    const fw4 = d28.toISOString().split('T')[0]
    const fw8 = d56.toISOString().split('T')[0]
    let recentTotal = 0, prevTotal = 0
    for (const e of timeline) {
      if (e.week >= fw4 && e.week <= todayStr) recentTotal += e.total
      else if (e.week >= fw8 && e.week < fw4)  prevTotal  += e.total
    }
    const growthRate = prevTotal > 0 ? Math.round(((recentTotal - prevTotal) / prevTotal) * 100) : 0

    return Response.json({
      kpis: { totalServices, totalAttendances, uniqueAttendees, avgPerService, growthRate },
      timeline,
      serviceBreakdown,
      newVsReturning: { new: newCount, returning: returningCount },
      topAttendees,
      distribution,
      monthlyTrends,
      cellBreakdown,
    })
  } catch (err) {
    console.error('Analytics error:', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

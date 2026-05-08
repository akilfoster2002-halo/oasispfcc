import { getSupabaseServer } from '@/lib/supabase-server'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

type Row = Record<string, unknown>

async function sql(
  supabase: ReturnType<typeof getSupabaseServer>,
  query: string,
): Promise<Row[]> {
  const { data, error } = await supabase.rpc('run_query', { sql: query.trim() })
  if (error) throw new Error(error.message)
  return (data as Row[]) ?? []
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const now = new Date()
    const defaultFrom = new Date(now)
    defaultFrom.setFullYear(now.getFullYear() - 1)

    const from  = searchParams.get('from')  ?? defaultFrom.toISOString().split('T')[0]
    const to    = searchParams.get('to')    ?? now.toISOString().split('T')[0]
    const group = searchParams.get('group') ?? null   // null = all groups

    // Validate date params to prevent injection
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return Response.json({ error: 'Invalid date parameters' }, { status: 400 })
    }

    const safeGroup = group?.replace(/[^a-zA-Z0-9 \-_]/g, '') ?? null
    const gf = safeGroup
      ? `AND g.name ILIKE '%${safeGroup}%'`
      : ''

    const supabase = getSupabaseServer()

    // ── All queries fire in parallel ───────────────────────────────────────
    const [
      kpiRows,
      timelineRows,
      groupRows,
      cellRows,
      newRetRows,
      distRows,
      retentionRows,
      sundayRows,
      topAttendeeRows,
    ] = await Promise.all([

      // KPIs
      sql(supabase, `
        SELECT
          COUNT(DISTINCT m.id)           AS total_meetings,
          COUNT(att.id)                  AS total_attendance,
          COUNT(DISTINCT att.attendee_id) AS unique_attendees,
          ROUND(COUNT(att.id)::numeric / NULLIF(COUNT(DISTINCT m.id),0), 1) AS avg_per_meeting
        FROM meetings m
        JOIN groups g ON g.id = m.group_id
        LEFT JOIN attendance att ON att.meeting_id = m.id AND att.status = 'present'
        WHERE m.meeting_date BETWEEN '${from}' AND '${to}'
        ${gf}
      `),

      // Weekly timeline by meeting type
      sql(supabase, `
        SELECT
          date_trunc('week', m.meeting_date)::date AS week,
          m.meeting_type,
          COUNT(att.id) AS cnt
        FROM meetings m
        JOIN groups g ON g.id = m.group_id
        LEFT JOIN attendance att ON att.meeting_id = m.id AND att.status = 'present'
        WHERE m.meeting_date BETWEEN '${from}' AND '${to}'
        ${gf}
        GROUP BY week, m.meeting_type
        ORDER BY week
      `),

      // Group-level summary
      sql(supabase, `
        SELECT
          g.name                          AS group_name,
          COUNT(DISTINCT m.id)            AS meetings,
          COUNT(att.id)                   AS total_attendance,
          COUNT(DISTINCT att.attendee_id) AS unique_attendees,
          ROUND(COUNT(att.id)::numeric / NULLIF(COUNT(DISTINCT m.id),0), 1) AS avg_per_meeting
        FROM groups g
        LEFT JOIN meetings m ON m.group_id = g.id
          AND m.meeting_date BETWEEN '${from}' AND '${to}'
        LEFT JOIN attendance att ON att.meeting_id = m.id AND att.status = 'present'
        GROUP BY g.id, g.name
        ORDER BY total_attendance DESC NULLS LAST
      `),

      // Cell health (top 20 cells)
      sql(supabase, `
        SELECT
          m.name                          AS cell_name,
          g.name                          AS group_name,
          COUNT(DISTINCT m.id)            AS sessions,
          COUNT(att.id)                   AS total,
          ROUND(COUNT(att.id)::numeric / NULLIF(COUNT(DISTINCT m.id),0), 1) AS avg
        FROM meetings m
        JOIN groups g ON g.id = m.group_id
        LEFT JOIN attendance att ON att.meeting_id = m.id AND att.status = 'present'
        WHERE m.meeting_type = 'Cell'
          AND m.meeting_date BETWEEN '${from}' AND '${to}'
        ${gf}
        GROUP BY m.name, g.name
        HAVING COUNT(DISTINCT m.id) > 0
        ORDER BY total DESC
        LIMIT 20
      `),

      // New vs returning attendees
      sql(supabase, `
        WITH current_ids AS (
          SELECT DISTINCT att.attendee_id
          FROM attendance att
          JOIN meetings m ON m.id = att.meeting_id
          JOIN groups g ON g.id = m.group_id
          WHERE att.status = 'present'
            AND m.meeting_date BETWEEN '${from}' AND '${to}'
          ${gf}
        ),
        prior_ids AS (
          SELECT DISTINCT att.attendee_id
          FROM attendance att
          JOIN meetings m ON m.id = att.meeting_id
          WHERE att.status = 'present'
            AND m.meeting_date < '${from}'
        )
        SELECT
          COUNT(CASE WHEN p.attendee_id IS NULL     THEN 1 END) AS new_count,
          COUNT(CASE WHEN p.attendee_id IS NOT NULL THEN 1 END) AS returning_count
        FROM current_ids c
        LEFT JOIN prior_ids p ON p.attendee_id = c.attendee_id
      `),

      // Attendance frequency distribution
      sql(supabase, `
        WITH counts AS (
          SELECT att.attendee_id, COUNT(*) AS times
          FROM attendance att
          JOIN meetings m ON m.id = att.meeting_id
          JOIN groups g ON g.id = m.group_id
          WHERE att.status = 'present'
            AND m.meeting_date BETWEEN '${from}' AND '${to}'
          ${gf}
          GROUP BY att.attendee_id
        )
        SELECT
          CASE
            WHEN times = 1       THEN '1'
            WHEN times <= 3      THEN '2–3'
            WHEN times <= 6      THEN '4–6'
            WHEN times <= 10     THEN '7–10'
            WHEN times <= 20     THEN '11–20'
            ELSE                      '21+'
          END AS bucket,
          COUNT(*) AS people,
          MIN(times) AS min_times
        FROM counts
        GROUP BY bucket
        ORDER BY min_times
      `),

      // Retention: active / lapsing / lapsed
      sql(supabase, `
        WITH last_seen AS (
          SELECT att.attendee_id, MAX(m.meeting_date) AS last_date
          FROM attendance att
          JOIN meetings m ON m.id = att.meeting_id
          JOIN groups g ON g.id = m.group_id
          WHERE att.status = 'present'
            AND m.meeting_date BETWEEN '${from}' AND '${to}'
          ${gf}
          GROUP BY att.attendee_id
        )
        SELECT
          COUNT(CASE WHEN last_date >= '${to}'::date - INTERVAL '30 days'  THEN 1 END) AS active,
          COUNT(CASE WHEN last_date <  '${to}'::date - INTERVAL '30 days'
                      AND last_date >= '${to}'::date - INTERVAL '60 days'  THEN 1 END) AS lapsing,
          COUNT(CASE WHEN last_date <  '${to}'::date - INTERVAL '60 days'  THEN 1 END) AS lapsed
        FROM last_seen
      `),

      // Sunday service weekly headcount (for dedicated Sunday trend)
      sql(supabase, `
        SELECT
          date_trunc('week', m.meeting_date)::date AS week,
          g.name                                   AS group_name,
          COUNT(att.id)                            AS cnt
        FROM meetings m
        JOIN groups g ON g.id = m.group_id
        LEFT JOIN attendance att ON att.meeting_id = m.id AND att.status = 'present'
        WHERE m.meeting_type = 'Sunday'
          AND m.meeting_date BETWEEN '${from}' AND '${to}'
        ${gf}
        GROUP BY week, g.name
        ORDER BY week
      `),

      // Top attendees
      sql(supabase, `
        SELECT
          a.name,
          COUNT(att.id) AS times
        FROM attendees a
        JOIN attendance att ON att.attendee_id = a.id
        JOIN meetings m ON m.id = att.meeting_id
        JOIN groups g ON g.id = m.group_id
        WHERE att.status = 'present'
          AND m.meeting_date BETWEEN '${from}' AND '${to}'
        ${gf}
        GROUP BY a.id, a.name
        ORDER BY times DESC
        LIMIT 15
      `),
    ])

    // ── Process weekly timeline into wide format ───────────────────────────
    const TYPES = ['Sunday', 'Wednesday', 'Cell', 'Prayer', 'Leadership', 'Special', 'Other']
    const weekMap = new Map<string, Record<string, number>>()
    for (const r of timelineRows) {
      const w = String(r.week).substring(0, 10)
      if (!weekMap.has(w)) weekMap.set(w, Object.fromEntries(TYPES.map(t => [t, 0])))
      const entry = weekMap.get(w)!
      const type  = String(r.meeting_type)
      entry[TYPES.includes(type) ? type : 'Other'] = (entry[TYPES.includes(type) ? type : 'Other'] ?? 0) + Number(r.cnt)
    }
    const timeline = Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, t]) => ({
        week,
        total: Object.values(t).reduce((s, v) => s + v, 0),
        ...t,
      }))

    // ── Monthly totals + growth ────────────────────────────────────────────
    const moMap = new Map<string, number>()
    for (const e of timeline) {
      const mo = e.week.substring(0, 7)
      moMap.set(mo, (moMap.get(mo) ?? 0) + e.total)
    }
    const moArr = Array.from(moMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    const monthlyTrends = moArr.map(([mo, total], i) => {
      const prior  = i > 0 ? moArr[i - 1][1] : null
      const growth = prior && prior > 0 ? Math.round(((total - prior) / prior) * 100) : 0
      const [y, m] = mo.split('-')
      const label  = new Date(Number(y), Number(m) - 1, 1)
        .toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      return { month: label, total, growth }
    })

    // ── Growth rate (last 4 weeks vs prior 4 weeks) ────────────────────────
    const d28 = new Date(to); d28.setDate(d28.getDate() - 28)
    const d56 = new Date(to); d56.setDate(d56.getDate() - 56)
    const w4  = d28.toISOString().split('T')[0]
    const w8  = d56.toISOString().split('T')[0]
    let recentTotal = 0, prevTotal = 0
    for (const e of timeline) {
      if (e.week >= w4) recentTotal += e.total
      else if (e.week >= w8) prevTotal += e.total
    }
    const growthRate = prevTotal > 0
      ? Math.round(((recentTotal - prevTotal) / prevTotal) * 100)
      : 0

    // ── Sunday group weekly (for per-group Sunday trend) ──────────────────
    const sundayGroups = Array.from(new Set(sundayRows.map(r => String(r.group_name))))
    const sundayWeekMap = new Map<string, Record<string, number>>()
    for (const r of sundayRows) {
      const w = String(r.week).substring(0, 10)
      if (!sundayWeekMap.has(w)) {
        sundayWeekMap.set(w, Object.fromEntries(sundayGroups.map(g => [g, 0])))
      }
      sundayWeekMap.get(w)![String(r.group_name)] = Number(r.cnt)
    }
    const sundayTimeline = Array.from(sundayWeekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, g]) => ({ week, ...g }))

    // ── Assemble response ──────────────────────────────────────────────────
    const kpi = kpiRows[0] ?? {}
    const nvr = newRetRows[0] ?? {}
    const ret = retentionRows[0] ?? {}

    return Response.json({
      kpis: {
        totalMeetings:   Number(kpi.total_meetings   ?? 0),
        totalAttendance: Number(kpi.total_attendance ?? 0),
        uniqueAttendees: Number(kpi.unique_attendees ?? 0),
        avgPerMeeting:   Number(kpi.avg_per_meeting  ?? 0),
        growthRate,
      },
      timeline,
      monthlyTrends,
      sundayTimeline,
      sundayGroups,
      groups: groupRows.map(r => ({
        name:            String(r.group_name),
        meetings:        Number(r.meetings        ?? 0),
        totalAttendance: Number(r.total_attendance ?? 0),
        uniqueAttendees: Number(r.unique_attendees ?? 0),
        avgPerMeeting:   Number(r.avg_per_meeting  ?? 0),
      })),
      cells: cellRows.map(r => ({
        name:     String(r.cell_name),
        group:    String(r.group_name),
        sessions: Number(r.sessions),
        total:    Number(r.total),
        avg:      Number(r.avg),
      })),
      newVsReturning: {
        new:       Number(nvr.new_count       ?? 0),
        returning: Number(nvr.returning_count ?? 0),
      },
      distribution: distRows.map(r => ({
        bucket: String(r.bucket),
        people: Number(r.people),
      })),
      retention: {
        active:   Number(ret.active   ?? 0),
        lapsing:  Number(ret.lapsing  ?? 0),
        lapsed:   Number(ret.lapsed   ?? 0),
      },
      topAttendees: topAttendeeRows.map(r => ({
        name:  String(r.name),
        times: Number(r.times),
      })),
    })
  } catch (err) {
    console.error('[analytics]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

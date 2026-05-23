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
    const group = searchParams.get('group') ?? null

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return Response.json({ error: 'Invalid date parameters' }, { status: 400 })
    }

    const safeGroup = group?.replace(/[^a-zA-Z0-9 \-_]/g, '') ?? null
    const gf      = safeGroup ? `AND g.name ILIKE '%${safeGroup}%'` : ''
    const wkAndGf = safeGroup ? `AND g.name ILIKE '%${safeGroup}%'` : ''
    const wkTopGf = safeGroup ? `WHERE g.name ILIKE '%${safeGroup}%'` : ''

    // Week boundaries (Sunday–Saturday) — always report on the last COMPLETED week.
    // On Sunday through Friday, that's the week that ended last Saturday.
    // On Saturday, it's the week that ends today.
    // This matches the workflow where reporting is done on Sundays for the prior week.
    const toD          = new Date(to + 'T12:00:00')
    const dow          = toD.getDay()
    const daysToLastSat = (dow + 1) % 7          // 0 on Sat, 1 on Sun, …, 6 on Fri
    const twEnd   = new Date(toD); twEnd.setDate(toD.getDate() - daysToLastSat)
    const twStart = new Date(twEnd); twStart.setDate(twEnd.getDate() - 6)
    const lwStart = new Date(twStart); lwStart.setDate(twStart.getDate() - 7)
    const tw0 = twStart.toISOString().split('T')[0]
    const tw1 = twEnd.toISOString().split('T')[0]
    const lw0 = lwStart.toISOString().split('T')[0]
    const lw1 = new Date(twStart.getTime() - 86400000).toISOString().split('T')[0]

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
      weeklyCellRows,
      weeklyGroupRows,
    ] = await Promise.all([

      // KPIs
      sql(supabase, `
        SELECT
          COUNT(DISTINCT e.id)           AS total_meetings,
          COUNT(att.id)                  AS total_attendance,
          COUNT(DISTINCT att.person_id)  AS unique_attendees,
          ROUND(COUNT(att.id)::numeric / NULLIF(COUNT(DISTINCT e.id),0), 1) AS avg_per_meeting
        FROM events e
        JOIN groups g ON g.id = e.group_id
        LEFT JOIN attendance att ON att.event_id = e.id AND att.attendance_status = 'present'
        WHERE e.event_date BETWEEN '${from}' AND '${to}'
        ${gf}
      `),

      // Weekly timeline by service type
      sql(supabase, `
        SELECT
          date_trunc('week', e.event_date)::date AS week,
          e.service_type,
          COUNT(att.id) AS cnt
        FROM events e
        JOIN groups g ON g.id = e.group_id
        LEFT JOIN attendance att ON att.event_id = e.id AND att.attendance_status = 'present'
        WHERE e.event_date BETWEEN '${from}' AND '${to}'
        ${gf}
        GROUP BY week, e.service_type
        ORDER BY week
      `),

      // Group-level summary
      sql(supabase, `
        SELECT
          g.name                         AS group_name,
          COUNT(DISTINCT e.id)           AS meetings,
          COUNT(att.id)                  AS total_attendance,
          COUNT(DISTINCT att.person_id)  AS unique_attendees,
          ROUND(COUNT(att.id)::numeric / NULLIF(COUNT(DISTINCT e.id),0), 1) AS avg_per_meeting
        FROM groups g
        LEFT JOIN events e ON e.group_id = g.id
          AND e.event_date BETWEEN '${from}' AND '${to}'
        LEFT JOIN attendance att ON att.event_id = e.id AND att.attendance_status = 'present'
        GROUP BY g.id, g.name
        ORDER BY total_attendance DESC NULLS LAST
      `),

      // Cell health (top 20 cells)
      sql(supabase, `
        SELECT
          e.name                         AS cell_name,
          g.name                         AS group_name,
          COUNT(DISTINCT e.id)           AS sessions,
          COUNT(att.id)                  AS total,
          ROUND(COUNT(att.id)::numeric / NULLIF(COUNT(DISTINCT e.id),0), 1) AS avg
        FROM events e
        JOIN groups g ON g.id = e.group_id
        LEFT JOIN attendance att ON att.event_id = e.id AND att.attendance_status = 'present'
        WHERE e.service_type = 'cell'
          AND e.event_date BETWEEN '${from}' AND '${to}'
        ${gf}
        GROUP BY e.name, g.name
        HAVING COUNT(DISTINCT e.id) > 0
        ORDER BY total DESC
        LIMIT 20
      `),

      // New vs returning people
      sql(supabase, `
        WITH current_ids AS (
          SELECT DISTINCT att.person_id
          FROM attendance att
          JOIN events e ON e.id = att.event_id
          JOIN groups g ON g.id = e.group_id
          WHERE att.attendance_status = 'present'
            AND e.event_date BETWEEN '${from}' AND '${to}'
          ${gf}
        ),
        prior_ids AS (
          SELECT DISTINCT att.person_id
          FROM attendance att
          JOIN events e ON e.id = att.event_id
          WHERE att.attendance_status = 'present'
            AND e.event_date < '${from}'
        )
        SELECT
          COUNT(CASE WHEN p.person_id IS NULL     THEN 1 END) AS new_count,
          COUNT(CASE WHEN p.person_id IS NOT NULL THEN 1 END) AS returning_count
        FROM current_ids c
        LEFT JOIN prior_ids p ON p.person_id = c.person_id
      `),

      // Attendance frequency distribution
      sql(supabase, `
        WITH counts AS (
          SELECT att.person_id, COUNT(*) AS times
          FROM attendance att
          JOIN events e ON e.id = att.event_id
          JOIN groups g ON g.id = e.group_id
          WHERE att.attendance_status = 'present'
            AND e.event_date BETWEEN '${from}' AND '${to}'
          ${gf}
          GROUP BY att.person_id
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
          SELECT att.person_id, MAX(e.event_date) AS last_date
          FROM attendance att
          JOIN events e ON e.id = att.event_id
          JOIN groups g ON g.id = e.group_id
          WHERE att.attendance_status = 'present'
            AND e.event_date BETWEEN '${from}' AND '${to}'
          ${gf}
          GROUP BY att.person_id
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
          date_trunc('week', e.event_date)::date AS week,
          g.name                                 AS group_name,
          COUNT(att.id)                          AS cnt
        FROM events e
        JOIN groups g ON g.id = e.group_id
        LEFT JOIN attendance att ON att.event_id = e.id AND att.attendance_status = 'present'
        WHERE e.service_type IN ('sunday_inperson', 'sunday_online')
          AND e.event_date BETWEEN '${from}' AND '${to}'
        ${gf}
        GROUP BY week, g.name
        ORDER BY week
      `),

      // Top attendees
      sql(supabase, `
        SELECT
          p.first_name || ' ' || p.last_name AS name,
          COUNT(att.id) AS times
        FROM people p
        JOIN attendance att ON att.person_id = p.id
        JOIN events e ON e.id = att.event_id
        JOIN groups g ON g.id = e.group_id
        WHERE att.attendance_status = 'present'
          AND e.event_date BETWEEN '${from}' AND '${to}'
        ${gf}
        GROUP BY p.id, p.first_name, p.last_name
        ORDER BY times DESC
        LIMIT 15
      `),

      // Weekly cell metrics: this week vs last week
      sql(supabase, `
        WITH this_week AS (
          SELECT
            e.name AS cell_name,
            g.id   AS group_id,
            g.name AS group_name,
            COALESCE(SUM(att.cnt), 0) AS attendance,
            SUM(e.soul_won)           AS soul_won,
            SUM(e.fs_enrolled)        AS fs_enrolled,
            SUM(e.substantiations)    AS substantiations,
            SUM(e.first_timers)       AS first_timers
          FROM events e
          JOIN groups g ON g.id = e.group_id
          LEFT JOIN (
            SELECT event_id, COUNT(*) AS cnt
            FROM attendance WHERE attendance_status = 'present'
            GROUP BY event_id
          ) att ON att.event_id = e.id
          WHERE e.service_type = 'cell'
            AND e.event_date BETWEEN '${tw0}' AND '${tw1}'
            ${wkAndGf}
          GROUP BY e.name, g.id, g.name
        ),
        last_week AS (
          SELECT
            e.name AS cell_name,
            g.id   AS group_id,
            g.name AS group_name,
            COALESCE(SUM(att.cnt), 0) AS attendance
          FROM events e
          JOIN groups g ON g.id = e.group_id
          LEFT JOIN (
            SELECT event_id, COUNT(*) AS cnt
            FROM attendance WHERE attendance_status = 'present'
            GROUP BY event_id
          ) att ON att.event_id = e.id
          WHERE e.service_type = 'cell'
            AND e.event_date BETWEEN '${lw0}' AND '${lw1}'
            ${wkAndGf}
          GROUP BY e.name, g.id, g.name
        )
        SELECT
          COALESCE(t.cell_name,      l.cell_name)   AS cell_name,
          COALESCE(t.group_name,     l.group_name)  AS group_name,
          COALESCE(t.attendance,     0)              AS att_this,
          COALESCE(l.attendance,     0)              AS att_last,
          COALESCE(t.soul_won,       0)              AS soul_won,
          COALESCE(t.fs_enrolled,    0)              AS fs_enrolled,
          COALESCE(t.substantiations,0)              AS substantiations,
          COALESCE(t.first_timers,   0)              AS first_timers
        FROM this_week t
        FULL OUTER JOIN last_week l
          ON l.cell_name = t.cell_name AND l.group_id = t.group_id
        ORDER BY COALESCE(t.group_name, l.group_name), COALESCE(t.cell_name, l.cell_name)
      `),

      // Weekly group summary
      sql(supabase, `
        WITH event_stats AS (
          SELECT
            e.group_id,
            e.event_date,
            e.service_type,
            e.first_timers,
            e.soul_won,
            COALESCE(att.cnt, 0) AS att_cnt
          FROM events e
          LEFT JOIN (
            SELECT event_id, COUNT(*) AS cnt
            FROM attendance WHERE attendance_status = 'present'
            GROUP BY event_id
          ) att ON att.event_id = e.id
          WHERE e.event_date BETWEEN '${lw0}' AND '${tw1}'
        ),
        uniq_this AS (
          SELECT e.group_id, COUNT(DISTINCT a.person_id) AS uniq
          FROM events e
          JOIN attendance a ON a.event_id = e.id AND a.attendance_status = 'present'
          WHERE e.event_date BETWEEN '${tw0}' AND '${tw1}'
          GROUP BY e.group_id
        ),
        uniq_last AS (
          SELECT e.group_id, COUNT(DISTINCT a.person_id) AS uniq
          FROM events e
          JOIN attendance a ON a.event_id = e.id AND a.attendance_status = 'present'
          WHERE e.event_date BETWEEN '${lw0}' AND '${lw1}'
          GROUP BY e.group_id
        )
        SELECT
          g.name AS group_name,
          COALESCE(SUM(CASE WHEN es.service_type = 'cell'
            AND es.event_date BETWEEN '${tw0}' AND '${tw1}' THEN es.att_cnt END), 0) AS cell_att_this,
          COALESCE(SUM(CASE WHEN es.service_type = 'cell'
            AND es.event_date BETWEEN '${lw0}' AND '${lw1}' THEN es.att_cnt END), 0) AS cell_att_last,
          COALESCE(SUM(CASE WHEN es.service_type IN ('sunday_inperson','sunday_online')
            AND es.event_date BETWEEN '${tw0}' AND '${tw1}' THEN es.att_cnt END), 0)    AS sunday_att_this,
          COALESCE(SUM(CASE WHEN es.service_type IN ('sunday_inperson','sunday_online')
            AND es.event_date BETWEEN '${lw0}' AND '${lw1}' THEN es.att_cnt END), 0)    AS sunday_att_last,
          COALESCE(SUM(CASE WHEN es.service_type IN ('sunday_inperson','sunday_online')
            AND es.event_date BETWEEN '${tw0}' AND '${tw1}' THEN es.first_timers END), 0) AS sun_first_timers_this,
          COALESCE(SUM(CASE WHEN es.service_type IN ('sunday_inperson','sunday_online')
            AND es.event_date BETWEEN '${lw0}' AND '${lw1}' THEN es.first_timers END), 0) AS sun_first_timers_last,
          COALESCE(SUM(CASE WHEN es.service_type = 'midweek'
            AND es.event_date BETWEEN '${tw0}' AND '${tw1}' THEN es.att_cnt END), 0)    AS wed_att_this,
          COALESCE(SUM(CASE WHEN es.service_type = 'midweek'
            AND es.event_date BETWEEN '${lw0}' AND '${lw1}' THEN es.att_cnt END), 0)    AS wed_att_last,
          COALESCE(SUM(CASE WHEN es.event_date BETWEEN '${tw0}' AND '${tw1}'
            THEN es.soul_won END), 0)                                                    AS soul_won_this,
          COALESCE(SUM(CASE WHEN es.event_date BETWEEN '${lw0}' AND '${lw1}'
            THEN es.soul_won END), 0)                                                    AS soul_won_last,
          COALESCE(SUM(es.soul_won), 0)  AS soul_tracker,
          COALESCE(ut.uniq, 0)           AS unique_this,
          COALESCE(ul.uniq, 0)           AS unique_last
        FROM groups g
        LEFT JOIN event_stats es ON es.group_id = g.id
        LEFT JOIN uniq_this ut ON ut.group_id = g.id
        LEFT JOIN uniq_last ul ON ul.group_id = g.id
        ${wkTopGf}
        GROUP BY g.id, g.name, ut.uniq, ul.uniq
        ORDER BY g.name
      `),
    ])

    // ── Process weekly timeline into wide format ───────────────────────────
    const TYPES = ['sunday_inperson', 'sunday_online', 'midweek', 'cell', 'outreach', 'prayer', 'other']
    const weekMap = new Map<string, Record<string, number>>()
    for (const r of timelineRows) {
      const w = String(r.week).substring(0, 10)
      if (!weekMap.has(w)) weekMap.set(w, Object.fromEntries(TYPES.map(t => [t, 0])))
      const entry = weekMap.get(w)!
      const type  = String(r.service_type)
      entry[TYPES.includes(type) ? type : 'other'] = (entry[TYPES.includes(type) ? type : 'other'] ?? 0) + Number(r.cnt)
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
        meetings:        Number(r.meetings         ?? 0),
        totalAttendance: Number(r.total_attendance  ?? 0),
        uniqueAttendees: Number(r.unique_attendees  ?? 0),
        avgPerMeeting:   Number(r.avg_per_meeting   ?? 0),
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
      weekly: {
        range: { thisWeek: { start: tw0, end: tw1 }, lastWeek: { start: lw0, end: lw1 } },
        cells: weeklyCellRows.map(r => ({
          cellName:        String(r.cell_name),
          groupName:       String(r.group_name),
          attThis:         Number(r.att_this),
          attLast:         Number(r.att_last),
          soulWon:         Number(r.soul_won),
          fsEnrolled:      Number(r.fs_enrolled),
          substantiations: Number(r.substantiations),
          firstTimers:     Number(r.first_timers),
        })),
        groups: weeklyGroupRows.map(r => ({
          groupName:          String(r.group_name),
          cellAttThis:        Number(r.cell_att_this),
          cellAttLast:        Number(r.cell_att_last),
          sundayAttThis:      Number(r.sunday_att_this),
          sundayAttLast:      Number(r.sunday_att_last),
          sunFirstTimersThis: Number(r.sun_first_timers_this),
          sunFirstTimersLast: Number(r.sun_first_timers_last),
          wedAttThis:         Number(r.wed_att_this),
          wedAttLast:         Number(r.wed_att_last),
          soulWonThis:        Number(r.soul_won_this),
          soulWonLast:        Number(r.soul_won_last),
          soulTracker:        Number(r.soul_tracker),
          uniqueThis:         Number(r.unique_this),
          uniqueLast:         Number(r.unique_last),
        })),
      },
    })
  } catch (err) {
    console.error('[analytics]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

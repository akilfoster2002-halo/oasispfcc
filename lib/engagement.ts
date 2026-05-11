import { SupabaseClient } from '@supabase/supabase-js'

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'

export type FlagType =
  | 'missed_sunday'
  | 'missed_midweek'
  | 'missed_cell'
  | 'inactive'
  | 'first_timer'

export type FlagSection =
  | 'red_flag'
  | 'missed_sunday'
  | 'missed_midweek'
  | 'missed_cell'
  | 'first_timer'
  | 'inactive'

export interface EngagementFlag {
  type: FlagType
  label: string
  detail: string
  severity: RiskLevel
}

export interface FlaggedMember {
  id: string
  name: string
  phone: string | null
  member_since: string
  total_attended: number
  last_attended: string | null
  days_since_last: number
  sunday_history: boolean[]
  midweek_history: boolean[]
  cell_history: boolean[]
  home_cell: string
  flags: EngagementFlag[]
  priority_score: number
  risk_level: RiskLevel
  sections: FlagSection[]
}

type AttRow = {
  attendee_id: string
  attendee_name: string
  phone: string | null
  created_at: string
  meeting_date: string
  meeting_type: string
  meeting_name: string
}

type ScheduleRow = {
  meeting_date: string
  meeting_type: string
  meeting_name: string
}

export async function computeEngagementFlags(
  supabase: SupabaseClient,
  groupId?: string | null,
): Promise<FlaggedMember[]> {
  if (!groupId) return []

  const today    = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const d180     = new Date(today.getTime() - 180 * 86400000).toISOString().split('T')[0]
  // "Recent" = last 30 days; "Prior" = 30–120 days ago (were they consistent before?)
  const cutRecent = new Date(today.getTime() -  30 * 86400000).toISOString().split('T')[0]
  const cutPrior  = new Date(today.getTime() - 120 * 86400000).toISOString().split('T')[0]

  // ── Query 1: all attendance for this group in the window ──────────────────
  const { data: rows, error } = await (supabase.rpc as Function)('run_query', {
    sql: `
      SELECT
        a.id           AS attendee_id,
        a.name         AS attendee_name,
        a.phone,
        a.created_at,
        m.meeting_date,
        m.meeting_type,
        m.name         AS meeting_name
      FROM attendance att
      JOIN meetings  m ON m.id = att.meeting_id
      JOIN attendees a ON a.id = att.attendee_id
      WHERE m.group_id     = '${groupId}'
        AND m.meeting_date >= '${d180}'
        AND m.meeting_date <= '${todayStr}'
        AND m.meeting_type  IN ('Sunday', 'Wednesday', 'Cell')
    `,
  }) as { data: AttRow[] | null; error: unknown }

  if (error || !rows || rows.length === 0) return []

  // ── Query 2: full meeting schedule (includes meetings nobody attended) ─────
  const { data: schedule } = await (supabase.rpc as Function)('run_query', {
    sql: `
      SELECT DISTINCT meeting_date, meeting_type, name AS meeting_name
      FROM meetings
      WHERE group_id     = '${groupId}'
        AND meeting_date >= '${d180}'
        AND meeting_date <= '${todayStr}'
        AND meeting_type  IN ('Sunday', 'Wednesday', 'Cell')
    `,
  }) as { data: ScheduleRow[] | null }

  const scheduleRows = schedule ?? []

  // Sunday schedule: unique dates newest-first (same-day duplicates collapsed)
  const sundaySchedule = [...new Set(
    scheduleRows.filter(r => r.meeting_type === 'Sunday').map(r => r.meeting_date)
  )].sort((a, b) => b.localeCompare(a))

  // Wednesday schedule
  const midweekSchedule = [...new Set(
    scheduleRows.filter(r => r.meeting_type === 'Wednesday').map(r => r.meeting_date)
  )].sort((a, b) => b.localeCompare(a))

  // Cell schedules keyed by cell name — each person has ONE home cell
  const cellScheduleByName = new Map<string, string[]>()
  for (const r of scheduleRows.filter(s => s.meeting_type === 'Cell')) {
    if (!cellScheduleByName.has(r.meeting_name)) cellScheduleByName.set(r.meeting_name, [])
    const arr = cellScheduleByName.get(r.meeting_name)!
    if (!arr.includes(r.meeting_date)) arr.push(r.meeting_date)
  }
  for (const arr of cellScheduleByName.values()) arr.sort((a, b) => b.localeCompare(a))

  // ── Build per-attendee maps ───────────────────────────────────────────────
  type Entry = {
    name: string; phone: string | null; created_at: string
    sunday: Set<string>
    midweek: Set<string>
    cellByName: Map<string, Set<string>>  // cellName → dates attended
    allDates: Set<string>
    lastDate: string
  }

  const attMap = new Map<string, Entry>()

  for (const row of rows) {
    if (!attMap.has(row.attendee_id)) {
      attMap.set(row.attendee_id, {
        name: row.attendee_name, phone: row.phone ?? null, created_at: row.created_at,
        sunday: new Set(), midweek: new Set(), cellByName: new Map(),
        allDates: new Set(), lastDate: '',
      })
    }
    const e = attMap.get(row.attendee_id)!
    e.allDates.add(row.meeting_date)
    if (row.meeting_date > e.lastDate) e.lastDate = row.meeting_date
    if (row.meeting_type === 'Sunday')    e.sunday.add(row.meeting_date)
    if (row.meeting_type === 'Wednesday') e.midweek.add(row.meeting_date)
    if (row.meeting_type === 'Cell') {
      if (!e.cellByName.has(row.meeting_name)) e.cellByName.set(row.meeting_name, new Set())
      e.cellByName.get(row.meeting_name)!.add(row.meeting_date)
    }
  }

  // ── Score and flag each attendee ──────────────────────────────────────────
  const flagged: FlaggedMember[] = []

  for (const [attendee_id, e] of attMap) {
    const lastDate   = e.lastDate || null
    const daysSince  = lastDate
      ? Math.floor((today.getTime() - new Date(lastDate).getTime()) / 86400000)
      : 999
    const totalAttended = e.allDates.size

    // Identify home cell: whichever cell name they attended most
    let homeCell    = ''
    let homeCellMax = 0
    for (const [name, dates] of e.cellByName) {
      if (dates.size > homeCellMax) { homeCellMax = dates.size; homeCell = name }
    }
    const homeCellSchedule  = homeCell ? (cellScheduleByName.get(homeCell) ?? []) : []
    const homeCellAttended  = e.cellByName.get(homeCell) ?? new Set<string>()

    // ── Period splits ─────────────────────────────────────────────────────
    // Recent = last 30 days; Prior = 30–120 days ago
    const sundayRecent  = sundaySchedule.filter(d => d >  cutRecent)
    const sundayPrior   = sundaySchedule.filter(d => d <= cutRecent && d >= cutPrior)
    const midweekRecent = midweekSchedule.filter(d => d >  cutRecent)
    const midweekPrior  = midweekSchedule.filter(d => d <= cutRecent && d >= cutPrior)
    const cellRecent    = homeCellSchedule.filter(d => d >  cutRecent)
    const cellPrior     = homeCellSchedule.filter(d => d <= cutRecent && d >= cutPrior)

    const sundayAttRecent  = sundayRecent.filter(d  => e.sunday.has(d)).length
    const sundayAttPrior   = sundayPrior.filter(d   => e.sunday.has(d)).length
    const midweekAttRecent = midweekRecent.filter(d => e.midweek.has(d)).length
    const midweekAttPrior  = midweekPrior.filter(d  => e.midweek.has(d)).length
    const cellAttRecent    = cellRecent.filter(d    => homeCellAttended.has(d)).length
    const cellAttPrior     = cellPrior.filter(d     => homeCellAttended.has(d)).length

    // History dots for UI (8 most recent from their schedule)
    const sundayHistory  = sundaySchedule.slice(0, 8).map(d => e.sunday.has(d))
    const midweekHistory = midweekSchedule.slice(0, 8).map(d => e.midweek.has(d))
    const cellHistory    = homeCellSchedule.slice(0, 8).map(d => homeCellAttended.has(d))

    const flags: EngagementFlag[] = []
    const sections = new Set<FlagSection>()

    // ── First timer ───────────────────────────────────────────────────────────
    const isFirstTimer = totalAttended <= 3 && daysSince > 14
    if (isFirstTimer) {
      flags.push({
        type: 'first_timer',
        label: totalAttended === 1 ? 'First Timer' : 'New Visitor',
        detail: totalAttended === 1
          ? `Visited once, ${daysSince}d ago — hasn't returned`
          : `Only ${totalAttended} visits, last seen ${daysSince} days ago`,
        severity: daysSince > 28 ? 'high' : 'medium',
      })
      sections.add('first_timer')
    }

    // ── Going inactive ────────────────────────────────────────────────────────
    if (!isFirstTimer && daysSince >= 45 && totalAttended >= 5) {
      flags.push({
        type: 'inactive',
        label: daysSince >= 60 ? 'Inactive — 60+ Days' : 'Going Inactive',
        detail: `Last attended ${daysSince} days ago`,
        severity: daysSince >= 60 ? 'critical' : 'high',
      })
      sections.add('inactive')
    }

    // ── Missed Sunday ─────────────────────────────────────────────────────────
    // Was consistent (≥2 Sundays in prior 30–120d window) then slipped (0 in last 30d)
    if (
      !isFirstTimer &&
      sundayAttPrior  >= 2 &&
      sundayRecent.length >= 1 &&
      sundayAttRecent === 0
    ) {
      const n = sundayRecent.length
      flags.push({
        type: 'missed_sunday',
        label: `Missed ${n} Sunday${n !== 1 ? 's' : ''}`,
        detail: `Was attending regularly — missed last ${n} Sunday${n !== 1 ? 's' : ''}`,
        severity: n >= 4 ? 'critical' : n >= 2 ? 'high' : 'medium',
      })
      sections.add('missed_sunday')
    }

    // ── Missed Midweek ────────────────────────────────────────────────────────
    if (
      !isFirstTimer &&
      midweekAttPrior  >= 2 &&
      midweekRecent.length >= 1 &&
      midweekAttRecent === 0
    ) {
      const n = midweekRecent.length
      flags.push({
        type: 'missed_midweek',
        label: `Missed ${n} Midweek${n !== 1 ? 's' : ''}`,
        detail: `Was attending regularly — missed last ${n} midweek service${n !== 1 ? 's' : ''}`,
        severity: n >= 4 ? 'high' : 'medium',
      })
      sections.add('missed_midweek')
    }

    // ── Missed Cell (home cell only) ──────────────────────────────────────────
    if (
      !isFirstTimer &&
      homeCell &&
      cellAttPrior  >= 2 &&
      cellRecent.length >= 1 &&
      cellAttRecent === 0
    ) {
      const n = cellRecent.length
      flags.push({
        type: 'missed_cell',
        label: `Missed ${n} Cell Meeting${n !== 1 ? 's' : ''}`,
        detail: `Consistent at ${homeCell} — missed last ${n} meeting${n !== 1 ? 's' : ''}`,
        severity: n >= 3 ? 'high' : 'medium',
      })
      sections.add('missed_cell')
    }

    if (flags.length === 0) continue

    // ── Priority score ────────────────────────────────────────────────────────
    let priority = 0

    // Depth bonus — long-term members matter more when they slip
    if (totalAttended >= 24)      priority += 40
    else if (totalAttended >= 12) priority += 28
    else if (totalAttended >= 6)  priority += 16
    else if (totalAttended >= 3)  priority += 8

    // Recency of last attendance
    if (daysSince >= 60)      priority += 30
    else if (daysSince >= 30) priority += 20
    else if (daysSince >= 14) priority += 10

    // Each service type missed compounds risk
    const multiMiss =
      (sundayAttRecent  === 0 && sundayRecent.length  >= 1 && sundayAttPrior  >= 2 ? 1 : 0) +
      (midweekAttRecent === 0 && midweekRecent.length >= 1 && midweekAttPrior >= 2 ? 1 : 0) +
      (cellAttRecent    === 0 && cellRecent.length    >= 1 && cellAttPrior    >= 2 && homeCell ? 1 : 0)
    if (multiMiss >= 2) priority += 20
    if (multiMiss === 3) priority += 10

    if (isFirstTimer) priority = Math.min(priority, 45)

    const risk_level: RiskLevel =
      priority >= 80 ? 'critical' :
      priority >= 55 ? 'high'     :
      priority >= 30 ? 'medium'   : 'low'

    if (risk_level === 'critical' || risk_level === 'high') sections.add('red_flag')

    flagged.push({
      id: attendee_id,
      name: e.name,
      phone: e.phone,
      member_since: e.created_at,
      total_attended: totalAttended,
      last_attended: lastDate,
      days_since_last: daysSince,
      sunday_history:  sundayHistory,
      midweek_history: midweekHistory,
      cell_history:    cellHistory,
      home_cell:       homeCell,
      flags,
      priority_score: priority,
      risk_level,
      sections: [...sections],
    })
  }

  return flagged.sort((a, b) => b.priority_score - a.priority_score)
}

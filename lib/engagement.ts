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
  flags: EngagementFlag[]
  priority_score: number
  risk_level: RiskLevel
  sections: FlagSection[]
}

function missedStreak(history: boolean[]): number {
  let n = 0
  for (const v of history) { if (!v) n++; else break }
  return n
}

type AttRow = {
  attendee_id: string
  attendee_name: string
  phone: string | null
  created_at: string
  meeting_date: string
  meeting_type: string
}

export async function computeEngagementFlags(
  supabase: SupabaseClient,
  groupId?: string | null,
): Promise<FlaggedMember[]> {
  if (!groupId) return []

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const d180 = new Date(today.getTime() - 180 * 86400000).toISOString().split('T')[0]

  // Single SQL JOIN — same run_query approach as the chatbot.
  // Avoids PostgREST .in() URL length limits that silently truncate large ID lists.
  const { data: rows, error } = await (supabase.rpc as Function)('run_query', {
    sql: `
      SELECT
        a.id           AS attendee_id,
        a.name         AS attendee_name,
        a.phone,
        a.created_at,
        m.meeting_date,
        m.meeting_type
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

  // Unique schedule dates per type, newest first, up to 8.
  // Using dates as keys naturally deduplicates same-day duplicate meetings.
  const uniqueDates = (type: string) =>
    [...new Set(rows.filter(r => r.meeting_type === type).map(r => r.meeting_date))]
      .sort((a, b) => b.localeCompare(a)).slice(0, 8)

  const sundayDates  = uniqueDates('Sunday')
  const midweekDates = uniqueDates('Wednesday')
  const cellDates    = uniqueDates('Cell')

  // Build per-attendee sets keyed by date
  type Entry = {
    name: string; phone: string | null; created_at: string
    sunday: Set<string>; midweek: Set<string>; cell: Set<string>
    allDates: Set<string>; lastDate: string
  }

  const attMap = new Map<string, Entry>()

  for (const row of rows) {
    if (!attMap.has(row.attendee_id)) {
      attMap.set(row.attendee_id, {
        name: row.attendee_name, phone: row.phone ?? null, created_at: row.created_at,
        sunday: new Set(), midweek: new Set(), cell: new Set(),
        allDates: new Set(), lastDate: '',
      })
    }
    const e = attMap.get(row.attendee_id)!
    e.allDates.add(row.meeting_date)
    if (row.meeting_date > e.lastDate) e.lastDate = row.meeting_date
    if (row.meeting_type === 'Sunday')    e.sunday.add(row.meeting_date)
    if (row.meeting_type === 'Wednesday') e.midweek.add(row.meeting_date)
    if (row.meeting_type === 'Cell')      e.cell.add(row.meeting_date)
  }

  const flagged: FlaggedMember[] = []

  for (const [attendee_id, e] of attMap) {
    const sundayHistory  = sundayDates.map(d => e.sunday.has(d))
    const midweekHistory = midweekDates.map(d => e.midweek.has(d))
    const cellHistory    = cellDates.map(d => e.cell.has(d))

    const missedSundayN  = missedStreak(sundayHistory)
    const missedMidweekN = missedStreak(midweekHistory)
    const missedCellN    = missedStreak(cellHistory)

    const prevSundayAtt  = sundayHistory.slice(missedSundayN).filter(Boolean).length
    const prevMidweekAtt = midweekHistory.slice(missedMidweekN).filter(Boolean).length
    const prevCellAtt    = cellHistory.slice(missedCellN).filter(Boolean).length

    const lastDate = e.lastDate || null
    const daysSince = lastDate
      ? Math.floor((today.getTime() - new Date(lastDate).getTime()) / 86400000)
      : 999
    const totalAttended = e.allDates.size

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

    // ── Missed Sundays (2+ consecutive, attended before in window) ────────────
    if (!isFirstTimer && missedSundayN >= 2 && prevSundayAtt >= 1 && sundayDates.length >= 3) {
      flags.push({
        type: 'missed_sunday',
        label: `Missed ${missedSundayN} Sunday${missedSundayN !== 1 ? 's' : ''}`,
        detail: `${missedSundayN} consecutive Sunday${missedSundayN !== 1 ? 's' : ''} missed`,
        severity: missedSundayN >= 4 ? 'critical' : missedSundayN >= 3 ? 'high' : 'medium',
      })
      sections.add('missed_sunday')
    }

    // ── Missed Midweek (3+ consecutive, attended before) ─────────────────────
    if (!isFirstTimer && missedMidweekN >= 3 && prevMidweekAtt >= 1 && midweekDates.length >= 4) {
      flags.push({
        type: 'missed_midweek',
        label: `Missed ${missedMidweekN} Midweek${missedMidweekN !== 1 ? 's' : ''}`,
        detail: `${missedMidweekN} consecutive midweek services missed`,
        severity: missedMidweekN >= 5 ? 'high' : 'medium',
      })
      sections.add('missed_midweek')
    }

    // ── Missed Cell (2+ consecutive, attended before) ─────────────────────────
    if (!isFirstTimer && missedCellN >= 2 && prevCellAtt >= 1 && cellDates.length >= 3) {
      flags.push({
        type: 'missed_cell',
        label: `Missed ${missedCellN} Cell Meeting${missedCellN !== 1 ? 's' : ''}`,
        detail: `${missedCellN} consecutive cell meetings missed`,
        severity: missedCellN >= 3 ? 'high' : 'medium',
      })
      sections.add('missed_cell')
    }

    if (flags.length === 0) continue

    // ── Priority score ────────────────────────────────────────────────────────
    let priority = 0

    if (totalAttended >= 24)      priority += 40
    else if (totalAttended >= 12) priority += 28
    else if (totalAttended >= 6)  priority += 16
    else if (totalAttended >= 3)  priority += 8

    priority += Math.min(missedSundayN, 5) * 14
    priority += Math.min(missedMidweekN, 5) * 8
    priority += Math.min(missedCellN, 5) * 7

    if (daysSince >= 60)      priority += 30
    else if (daysSince >= 30) priority += 15

    const multiMiss =
      (missedSundayN >= 2 ? 1 : 0) +
      (missedMidweekN >= 3 ? 1 : 0) +
      (missedCellN >= 2 ? 1 : 0)
    if (multiMiss >= 2) priority += 18

    if (isFirstTimer) priority = Math.min(priority, 45)

    const risk_level: RiskLevel =
      priority >= 80 ? 'critical' :
      priority >= 55 ? 'high' :
      priority >= 30 ? 'medium' : 'low'

    if (risk_level === 'critical' || risk_level === 'high') sections.add('red_flag')

    flagged.push({
      id: attendee_id,
      name: e.name,
      phone: e.phone,
      member_since: e.created_at,
      total_attended: totalAttended,
      last_attended: lastDate,
      days_since_last: daysSince,
      sunday_history: sundayHistory,
      midweek_history: midweekHistory,
      cell_history: cellHistory,
      flags,
      priority_score: priority,
      risk_level,
      sections: [...sections],
    })
  }

  return flagged.sort((a, b) => b.priority_score - a.priority_score)
}

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
  sunday_history: boolean[]   // newest first, true = attended
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

// Collapse duplicate meetings on the same date: { date, ids[] }, newest first, up to `limit` dates
function dedupDates(meetings: { id: string; meeting_date: string; meeting_type: string }[], type: string, limit: number) {
  const map = new Map<string, string[]>()
  for (const m of meetings) {
    if (m.meeting_type !== type) continue
    if (!map.has(m.meeting_date)) map.set(m.meeting_date, [])
    map.get(m.meeting_date)!.push(m.id)
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, limit)
    .map(([date, ids]) => ({ date, ids }))
}

export async function computeEngagementFlags(
  supabase: SupabaseClient,
  groupId?: string | null,
): Promise<FlaggedMember[]> {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const d180 = new Date(today.getTime() - 180 * 86400000).toISOString().split('T')[0]

  // 1. Fetch all relevant meetings in last 180 days
  let meetQ = supabase
    .from('meetings')
    .select('id, meeting_date, meeting_type, group_id')
    .gte('meeting_date', d180)
    .lte('meeting_date', todayStr)
    .in('meeting_type', ['Sunday', 'Wednesday', 'Cell'])
    .order('meeting_date', { ascending: false })
  if (groupId) meetQ = meetQ.eq('group_id', groupId)
  const { data: meetings } = await meetQ

  // Deduplicate by date: two services on the same day count as one "slot"
  const sundayDates  = dedupDates(meetings ?? [], 'Sunday',    8)
  const midweekDates = dedupDates(meetings ?? [], 'Wednesday', 8)
  const cellDates    = dedupDates(meetings ?? [], 'Cell',      8)
  const allIds       = (meetings ?? []).map(m => m.id)
  if (allIds.length === 0) return []

  // 2. Fetch all attendance for those meetings
  const { data: attRows } = await supabase
    .from('attendance')
    .select('meeting_id, attendee_id')
    .in('meeting_id', allIds)

  // 3. Build per-attendee maps
  const meetingDateMap = new Map((meetings ?? []).map(m => [m.id, m.meeting_date] as [string, string]))
  const sundaySet  = new Set(sundayDates.flatMap(d => d.ids))
  const midweekSet = new Set(midweekDates.flatMap(d => d.ids))
  const cellSet    = new Set(cellDates.flatMap(d => d.ids))

  type Entry = { sunday: Set<string>; midweek: Set<string>; cell: Set<string>; all: Set<string>; lastDate: string }
  const attMap = new Map<string, Entry>()

  for (const row of attRows ?? []) {
    if (!attMap.has(row.attendee_id)) {
      attMap.set(row.attendee_id, {
        sunday: new Set(), midweek: new Set(), cell: new Set(), all: new Set(), lastDate: '',
      })
    }
    const e = attMap.get(row.attendee_id)!
    e.all.add(row.meeting_id)
    const d = meetingDateMap.get(row.meeting_id) ?? ''
    if (d > e.lastDate) e.lastDate = d
    if (sundaySet.has(row.meeting_id))  e.sunday.add(row.meeting_id)
    if (midweekSet.has(row.meeting_id)) e.midweek.add(row.meeting_id)
    if (cellSet.has(row.meeting_id))    e.cell.add(row.meeting_id)
  }

  if (attMap.size === 0) return []

  // 4. Fetch attendee details
  const { data: attendees } = await supabase
    .from('attendees')
    .select('id, name, phone, created_at')
    .in('id', [...attMap.keys()])

  // 5. Score and flag each attendee
  const flagged: FlaggedMember[] = []

  for (const attendee of attendees ?? []) {
    const e = attMap.get(attendee.id)
    if (!e) continue

    // One boolean per unique date — attended if they attended ANY meeting on that date
    const sundayHistory  = sundayDates.map(d => d.ids.some(id => e.sunday.has(id)))
    const midweekHistory = midweekDates.map(d => d.ids.some(id => e.midweek.has(id)))
    const cellHistory    = cellDates.map(d => d.ids.some(id => e.cell.has(id)))

    const missedSundayN  = missedStreak(sundayHistory)
    const missedMidweekN = missedStreak(midweekHistory)
    const missedCellN    = missedStreak(cellHistory)

    // How many did they attend BEFORE the current missing streak?
    const prevSundayAtt  = sundayHistory.slice(missedSundayN).filter(Boolean).length
    const prevMidweekAtt = midweekHistory.slice(missedMidweekN).filter(Boolean).length
    const prevCellAtt    = cellHistory.slice(missedCellN).filter(Boolean).length

    const lastDate = e.lastDate || null
    const daysSince = lastDate
      ? Math.floor((today.getTime() - new Date(lastDate).getTime()) / 86400000)
      : 999
    const totalAttended = e.all.size

    const flags: EngagementFlag[] = []
    const sections = new Set<FlagSection>()

    // ── First timer ────────────────────────────────────────────────────────
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

    // ── Going inactive ─────────────────────────────────────────────────────
    if (!isFirstTimer && daysSince >= 45 && totalAttended >= 5) {
      flags.push({
        type: 'inactive',
        label: daysSince >= 60 ? 'Inactive — 60+ Days' : 'Going Inactive',
        detail: `Last attended ${daysSince} days ago`,
        severity: daysSince >= 60 ? 'critical' : 'high',
      })
      sections.add('inactive')
    }

    // ── Missed Sundays (2+ consecutive, attended before in window) ─────────
    if (!isFirstTimer && missedSundayN >= 2 && prevSundayAtt >= 1 && sundayDates.length >= 3) {
      flags.push({
        type: 'missed_sunday',
        label: `Missed ${missedSundayN} Sunday${missedSundayN !== 1 ? 's' : ''}`,
        detail: `${missedSundayN} consecutive Sunday${missedSundayN !== 1 ? 's' : ''} missed`,
        severity: missedSundayN >= 4 ? 'critical' : missedSundayN >= 3 ? 'high' : 'medium',
      })
      sections.add('missed_sunday')
    }

    // ── Missed Midweek (3+ consecutive, attended before) ──────────────────
    if (!isFirstTimer && missedMidweekN >= 3 && prevMidweekAtt >= 1 && midweekDates.length >= 4) {
      flags.push({
        type: 'missed_midweek',
        label: `Missed ${missedMidweekN} Midweek${missedMidweekN !== 1 ? 's' : ''}`,
        detail: `${missedMidweekN} consecutive midweek services missed`,
        severity: missedMidweekN >= 5 ? 'high' : 'medium',
      })
      sections.add('missed_midweek')
    }

    // ── Missed Cell (2+ consecutive, attended before) ─────────────────────
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

    // ── Priority score ─────────────────────────────────────────────────────
    let priority = 0

    // Depth bonus — long-term members are higher priority when they slip
    if (totalAttended >= 24) priority += 40
    else if (totalAttended >= 12) priority += 28
    else if (totalAttended >= 6)  priority += 16
    else if (totalAttended >= 3)  priority += 8

    priority += Math.min(missedSundayN, 5) * 14
    priority += Math.min(missedMidweekN, 5) * 8
    priority += Math.min(missedCellN, 5) * 7

    if (daysSince >= 60)  priority += 30
    else if (daysSince >= 30) priority += 15

    // Multiple service types simultaneously missed → compounding risk
    const multiMiss =
      (missedSundayN >= 2 ? 1 : 0) +
      (missedMidweekN >= 3 ? 1 : 0) +
      (missedCellN >= 2 ? 1 : 0)
    if (multiMiss >= 2) priority += 18

    // Cap first-timers — they're important but context is limited
    if (isFirstTimer) priority = Math.min(priority, 45)

    const risk_level: RiskLevel =
      priority >= 80 ? 'critical' :
      priority >= 55 ? 'high' :
      priority >= 30 ? 'medium' : 'low'

    if (risk_level === 'critical' || risk_level === 'high') sections.add('red_flag')

    flagged.push({
      id: attendee.id,
      name: attendee.name,
      phone: attendee.phone ?? null,
      member_since: attendee.created_at,
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

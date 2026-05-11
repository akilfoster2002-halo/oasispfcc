/**
 * Core calendar sync logic — shared between the CLI script and the API route.
 * Does NOT read .env.local; expects env vars to already be in process.env.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { fetchEventAttendance } from './breeze'

export const CALENDAR_FEEDS: { url: string; group: string }[] = [
  { url: 'https://blwoasischurchinc.breezechms.com/events/feed/MjAzNTg4LzkyMDk1', group: 'MEGA' },
  { url: 'https://blwoasischurchinc.breezechms.com/events/feed/MjAzNTg4LzkyMDk4', group: 'CharmCity' },
  { url: 'https://blwoasischurchinc.breezechms.com/events/feed/MjAzNTg4LzkyMDk5', group: 'Zone B' },
  { url: 'https://blwoasischurchinc.breezechms.com/events/feed/MjAzNTg4LzkyMDkz', group: 'LifeSprings' },
  { url: 'https://blwoasischurchinc.breezechms.com/events/feed/MjAzNTg4LzkyMDk0', group: 'Vanguards' },
  { url: 'https://blwoasischurchinc.breezechms.com/events/feed/MjAzNTg4LzkyMDk2', group: 'Trailblazers' },
  { url: 'https://blwoasischurchinc.breezechms.com/events/feed/MjAzNTg4LzEwNjgzMg%3D%3D', group: 'Missions' },
  { url: 'https://blwoasischurchinc.breezechms.com/events/feed/MjAzNTg4LzEwMTY4OQ%3D%3D', group: 'Capital City' },
]

export interface SyncResult {
  group: string
  meetingsCreated: number
  attendanceAdded: number
  skippedNoAttendance: number
  errors: number
  errorDetails: string[]
}

interface CalEvent {
  instanceId: number
  name: string
  date: string
}

function parseIcal(ical: string): CalEvent[] {
  const events: CalEvent[] = []
  let cur: Partial<CalEvent> | null = null
  for (const raw of ical.split('\n')) {
    const line = raw.trim()
    if (line === 'BEGIN:VEVENT') { cur = {} }
    else if (line === 'END:VEVENT' && cur) {
      if (cur.instanceId && cur.name && cur.date) events.push(cur as CalEvent)
      cur = null
    } else if (cur) {
      if (line.startsWith('SUMMARY:')) cur.name = line.slice(8).trim()
      else if (line.startsWith('DTSTART')) {
        const dt = line.replace(/^DTSTART[^:]*:/, '')
        cur.date = `${dt.slice(0,4)}-${dt.slice(4,6)}-${dt.slice(6,8)}`
      } else if (line.startsWith('UID:')) {
        const m = line.match(/PID(\d+)@/)
        if (m) cur.instanceId = Number(m[1])
      }
    }
  }
  return events
}

function meetingType(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('sunday')) return 'Sunday'
  if (n.includes('wednesday') || n.includes('midweek') || n.includes('wed service')) return 'Wednesday'
  if (
    n.includes('cell') || n.includes('bible study') ||
    n.includes('tcnj') || n.includes('baruch') || n.includes('hunter') ||
    n.includes('rit') || n.includes('qcc') || n.includes('st. john') ||
    n.includes('brooklyn') || n.includes('russel') || n.includes('york') ||
    n.includes('cooper') || n.includes('visionar') || n.includes('setter') ||
    n.includes('huios') || n.includes('hom usa') || n.includes('ethereal') ||
    n.includes('sage') || n.includes('devotion') || n.includes('love cell')
  ) return 'Cell'
  if (n.includes('leaders') || n.includes('professionals') || n.includes('roundtable')) return 'Leadership'
  return 'Special'
}

// Run up to `limit` async tasks concurrently
async function concurrent<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0
  async function worker() {
    while (next < tasks.length) {
      const i = next++
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

export function createSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function syncCalendarFeed(
  supabase: SupabaseClient,
  feedUrl: string,
  groupName: string,
  groupId: string | null,
  from: string,
  to: string,
  breezeToUuid: Map<number, string>,
  onProgress?: (msg: string) => void,
): Promise<SyncResult> {
  const result: SyncResult = {
    group: groupName,
    meetingsCreated: 0, attendanceAdded: 0,
    skippedNoAttendance: 0, errors: 0, errorDetails: [],
  }

  // 1. Fetch and parse iCal
  let events: CalEvent[]
  try {
    const res = await fetch(feedUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    events = parseIcal(await res.text()).filter(e => e.date >= from && e.date <= to)
  } catch (err) {
    const msg = `Calendar fetch failed for ${groupName}: ${err instanceof Error ? err.message : String(err)}`
    result.errors++
    result.errorDetails.push(msg)
    onProgress?.(`  ERROR: ${msg}`)
    return result
  }

  if (events.length === 0) {
    onProgress?.(`  [${groupName}] No events in range`)
    return result
  }

  onProgress?.(`  [${groupName}] ${events.length} events to process`)

  // 2. Load existing meetings for this group in range (filter by group to avoid cross-group collision)
  const { data: existingMeetings } = await supabase
    .from('meetings')
    .select('id, name, meeting_date')
    .eq('group_id', groupId ?? '')
    .gte('meeting_date', from)
    .lte('meeting_date', to)

  // Key includes group to prevent cross-group name collisions
  const meetingKey = (name: string, date: string) => `${groupName}|${name.toLowerCase().trim()}|${date}`
  const meetingMap = new Map<string, string>()
  for (const m of existingMeetings ?? []) meetingMap.set(meetingKey(m.name, m.meeting_date), m.id)

  // 3. Process events concurrently (5 at a time to respect Breeze rate limits)
  await concurrent(events.map(ev => async () => {
    try {
      onProgress?.(`    [${groupName}] ${ev.date} — ${ev.name}`)

      const records = await fetchEventAttendance(String(ev.instanceId))
      if (records.length === 0) {
        result.skippedNoAttendance++
        return
      }

      // Upsert meeting
      const key = meetingKey(ev.name, ev.date)
      let meetingId: string | undefined = meetingMap.get(key)
      if (!meetingId) {
        const { data: newM, error: mErr } = await supabase
          .from('meetings')
          .insert({
            name: ev.name,
            meeting_date: ev.date,
            meeting_type: meetingType(ev.name),
            group_id: groupId,
          })
          .select('id')
          .single()
        if (mErr || !newM?.id) {
          result.errors++
          result.errorDetails.push(`Meeting insert failed [${groupName}] ${ev.date} ${ev.name}: ${mErr?.message}`)
          return
        }
        meetingId = newM.id as string
        meetingMap.set(key, meetingId)
        result.meetingsCreated++
      }

      // Fetch existing attendance for this meeting
      const { data: existingAtt } = await supabase
        .from('attendance')
        .select('attendee_id')
        .eq('meeting_id', meetingId)
      const alreadyPresent = new Set((existingAtt ?? []).map((a: { attendee_id: string }) => a.attendee_id))

      const toInsert = records
        .map(rec => ({
          meeting_id: meetingId!,
          attendee_id: breezeToUuid.get(Number(rec.person_id))!,
          status: 'present',
        }))
        .filter(r => r.attendee_id && !alreadyPresent.has(r.attendee_id))

      if (toInsert.length === 0) return

      // Insert in batches of 500 to avoid request size limits
      for (let i = 0; i < toInsert.length; i += 500) {
        const batch = toInsert.slice(i, i + 500)
        const { error: aErr } = await supabase.from('attendance').insert(batch)
        if (aErr) {
          result.errors++
          result.errorDetails.push(`Attendance insert failed [${groupName}] ${ev.name}: ${aErr.message}`)
          return
        }
        result.attendanceAdded += batch.length
      }
    } catch (err) {
      result.errors++
      result.errorDetails.push(`Event error [${groupName}] ${ev.date} ${ev.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }), 5)

  return result
}

export async function syncAllFeeds(
  from: string,
  to: string,
  onProgress?: (msg: string) => void,
): Promise<SyncResult[]> {
  const supabase = createSupabaseAdmin()

  // Load groups once
  const { data: groupRows } = await supabase.from('groups').select('id, name')
  const groupMap = new Map<string, string>(
    (groupRows ?? []).map((g: { id: string; name: string }) => [g.name, g.id])
  )
  onProgress?.(`Loaded ${groupMap.size} groups`)

  // Load all attendees once — shared across all group syncs to avoid 8× fetches
  const breezeToUuid = new Map<number, string>()
  let offset = 0
  while (true) {
    const { data: rows } = await supabase
      .from('attendees')
      .select('id, breeze_id')
      .not('breeze_id', 'is', null)
      .range(offset, offset + 999)
    if (!rows || rows.length === 0) break
    for (const r of rows) breezeToUuid.set(Number(r.breeze_id), r.id)
    if (rows.length < 1000) break
    offset += 1000
  }
  onProgress?.(`Loaded ${breezeToUuid.size} attendees`)

  // Sync all groups sequentially (Breeze API is shared, concurrent groups would hit rate limits)
  const results: SyncResult[] = []
  for (const feed of CALENDAR_FEEDS) {
    onProgress?.(`\nSyncing ${feed.group}...`)
    const groupId = groupMap.get(feed.group) ?? null
    if (!groupId) {
      onProgress?.(`  WARNING: group "${feed.group}" not found in database — skipping`)
      continue
    }
    const r = await syncCalendarFeed(
      supabase, feed.url, feed.group, groupId, from, to, breezeToUuid, onProgress,
    )
    results.push(r)
    onProgress?.(
      `  → ${r.meetingsCreated} meetings created, ${r.attendanceAdded} attendance records, ` +
      `${r.skippedNoAttendance} skipped (no attendance), ${r.errors} errors`
    )
  }

  return results
}

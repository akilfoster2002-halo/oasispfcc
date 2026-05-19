/**
 * Core calendar sync logic — shared between the CLI script and the API route.
 * Does NOT read .env.local; expects env vars to already be in process.env.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { fetchEventAttendance, classifyServiceType } from './breeze'

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
  churchId: string,
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

  // 2. Load existing events for this group in range
  const { data: existingEvents } = await supabase
    .from('events')
    .select('id, name, event_date')
    .eq('group_id', groupId ?? '')
    .gte('event_date', from)
    .lte('event_date', to)

  const eventKey = (name: string, date: string) => `${groupName}|${name.toLowerCase().trim()}|${date}`
  const eventMap = new Map<string, string>()
  for (const e of existingEvents ?? []) eventMap.set(eventKey(e.name, e.event_date), e.id)

  // 3. Process events concurrently (5 at a time to respect Breeze rate limits)
  await concurrent(events.map(ev => async () => {
    try {
      onProgress?.(`    [${groupName}] ${ev.date} — ${ev.name}`)

      const records = await fetchEventAttendance(String(ev.instanceId))
      if (records.length === 0) {
        result.skippedNoAttendance++
        return
      }

      // Upsert event
      const key = eventKey(ev.name, ev.date)
      let eventId: string | undefined = eventMap.get(key)
      if (!eventId) {
        const { data: newE, error: eErr } = await supabase
          .from('events')
          .upsert({
            church_id:          churchId,
            breeze_instance_id: String(ev.instanceId),
            name:               ev.name,
            event_date:         ev.date,
            service_type:       classifyServiceType(ev.name),
            group_id:           groupId,
          }, { onConflict: 'breeze_instance_id' })
          .select('id')
          .single()
        if (eErr || !newE?.id) {
          result.errors++
          result.errorDetails.push(`Event upsert failed [${groupName}] ${ev.date} ${ev.name}: ${eErr?.message}`)
          return
        }
        eventId = newE.id as string
        eventMap.set(key, eventId)
        result.meetingsCreated++
      }

      // Fetch existing attendance for this event
      const { data: existingAtt } = await supabase
        .from('attendance')
        .select('person_id')
        .eq('event_id', eventId)
      const alreadyPresent = new Set((existingAtt ?? []).map((a: { person_id: string }) => a.person_id))

      const toInsert = records
        .map(rec => ({
          church_id:           churchId,
          event_id:            eventId!,
          person_id:           breezeToUuid.get(Number(rec.person_id))!,
          attendance_status:   'present',
          imported_from_breeze: true,
        }))
        .filter(r => r.person_id && !alreadyPresent.has(r.person_id))

      if (toInsert.length === 0) return

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

  // Resolve PFCC church ID
  const churchSlug = process.env.CHURCH_SLUG ?? 'pfcc'
  const { data: church } = await supabase
    .from('churches')
    .select('id')
    .eq('slug', churchSlug)
    .single()
  if (!church?.id) throw new Error(`Church "${churchSlug}" not found in database`)
  const churchId = church.id as string
  onProgress?.(`Church: ${churchSlug} (${churchId})`)

  // Load groups for this church
  const { data: groupRows } = await supabase
    .from('groups')
    .select('id, name')
    .eq('church_id', churchId)
  const groupMap = new Map<string, string>(
    (groupRows ?? []).map((g: { id: string; name: string }) => [g.name, g.id])
  )
  onProgress?.(`Loaded ${groupMap.size} groups`)

  // Load all people for this church (breeze_id → uuid)
  const breezeToUuid = new Map<number, string>()
  let offset = 0
  while (true) {
    const { data: rows } = await supabase
      .from('people')
      .select('id, breeze_id')
      .eq('church_id', churchId)
      .not('breeze_id', 'is', null)
      .range(offset, offset + 999)
    if (!rows || rows.length === 0) break
    for (const r of rows) breezeToUuid.set(Number(r.breeze_id), r.id)
    if (rows.length < 1000) break
    offset += 1000
  }
  onProgress?.(`Loaded ${breezeToUuid.size} people`)

  const results: SyncResult[] = []
  for (const feed of CALENDAR_FEEDS) {
    onProgress?.(`\nSyncing ${feed.group}...`)
    const groupId = groupMap.get(feed.group) ?? null
    if (!groupId) {
      onProgress?.(`  WARNING: group "${feed.group}" not found — skipping`)
      continue
    }
    const r = await syncCalendarFeed(
      supabase, feed.url, feed.group, groupId, churchId, from, to, breezeToUuid, onProgress,
    )
    results.push(r)
    onProgress?.(
      `  → ${r.meetingsCreated} events created, ${r.attendanceAdded} attendance records, ` +
      `${r.skippedNoAttendance} skipped (no attendance), ${r.errors} errors`
    )
  }

  return results
}

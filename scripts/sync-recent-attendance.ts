/**
 * Pull recent Breeze events + attendance into Supabase (meetings/attendees/attendance schema).
 *
 * Run: npx tsx scripts/sync-recent-attendance.ts [from] [to]
 * Example: npx tsx scripts/sync-recent-attendance.ts 2026-04-25 2026-05-09
 *
 * Defaults: last 2 weeks → today
 */

import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'
import { fetchEvents, fetchEventAttendance } from '../lib/breeze'

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = path.join(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

// ── Classify meeting type ─────────────────────────────────────────────────────
function meetingType(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('sunday')) return 'Sunday'
  if (n.includes('wednesday') || n.includes('midweek') || n.includes('wed service')) return 'Wednesday'
  if (n.includes('cell') || n.includes('small group') || n.includes('bible study')) return 'Cell'
  if (n.includes('leadership') || n.includes('professionals') || n.includes('impact hub')) return 'Leadership'
  return 'Special'
}

// ── Infer group from event name ───────────────────────────────────────────────
function inferGroupId(name: string, groupMap: Map<string, string>): string | null {
  const n = name.toLowerCase()
  if (n.startsWith('ls ') || n.includes('lifesprings')) return groupMap.get('LifeSprings') ?? null
  if (
    n.includes('charm') || n.includes('baltimore') ||
    n.includes('theo ') || n.includes('kinging') ||
    n.includes('christ army') || n.includes('huios') ||
    n.includes('faith fusion')
  ) return groupMap.get('CharmCity') ?? null
  // Default to MEGA for everything else
  return groupMap.get('MEGA') ?? null
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const today = new Date().toISOString().split('T')[0]
  const twoWeeksAgo = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 14)
    return d.toISOString().split('T')[0]
  })()

  const from = process.argv[2] ?? twoWeeksAgo
  const to   = process.argv[3] ?? today

  console.log(`=== Breeze → Supabase Attendance Sync (${from} → ${to}) ===\n`)

  // 1. Load groups
  const { data: groupRows } = await supabase.from('groups').select('id, name')
  const groupMap = new Map<string, string>((groupRows ?? []).map(g => [g.name, g.id]))
  console.log(`Groups: ${[...groupMap.keys()].join(', ')}`)

  // 2. Load attendees: breeze_id → supabase id
  console.log('Loading attendees...')
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
  console.log(`  ${breezeToUuid.size} attendees with breeze_id\n`)

  // 3. Load existing meetings in range: (name_lower + date) → id
  const { data: existingMeetings } = await supabase
    .from('meetings')
    .select('id, name, meeting_date, group_id, meeting_type')
    .gte('meeting_date', from)
    .lte('meeting_date', to)
  const meetingKey = (name: string, date: string) => `${name.toLowerCase().trim()}|${date}`
  const meetingMap = new Map<string, string>()
  for (const m of existingMeetings ?? []) {
    meetingMap.set(meetingKey(m.name, m.meeting_date), m.id)
  }
  console.log(`Existing meetings in range: ${meetingMap.size}`)

  // 4. Fetch Breeze events
  console.log('Fetching events from Breeze...')
  const events = await fetchEvents(from, to)
  console.log(`  ${events.length} events found\n`)

  // 5. Process each event
  let meetingsCreated = 0
  let attendanceAdded = 0
  let skipped = 0
  let errors = 0

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]
    const date = (ev.start_datetime ?? '').substring(0, 10) || from
    process.stdout.write(`\r[${i + 1}/${events.length}] ${ev.name.substring(0, 50).padEnd(50)}`)

    // Find or create meeting
    const key = meetingKey(ev.name, date)
    let meetingId = meetingMap.get(key)

    if (!meetingId) {
      const gid = inferGroupId(ev.name, groupMap)
      const { data: newMeeting, error: mErr } = await supabase
        .from('meetings')
        .insert({
          name:         ev.name,
          meeting_date: date,
          meeting_type: meetingType(ev.name),
          group_id:     gid,
        })
        .select('id')
        .single()

      if (mErr || !newMeeting) {
        errors++
        continue
      }
      meetingId = newMeeting.id as string
      meetingMap.set(key, meetingId)
      meetingsCreated++
    }

    // Fetch attendance
    const records = await fetchEventAttendance(ev.id)
    if (records.length === 0) continue

    // Load existing attendance for this meeting (avoid duplicates)
    const { data: existingAtt } = await supabase
      .from('attendance')
      .select('attendee_id')
      .eq('meeting_id', meetingId)
    const alreadyPresent = new Set((existingAtt ?? []).map(a => a.attendee_id))

    // Build new rows
    const toInsert: { meeting_id: string; attendee_id: string; status: string }[] = []
    for (const rec of records) {
      const aid = breezeToUuid.get(Number(rec.person_id))
      if (!aid) { skipped++; continue }
      if (alreadyPresent.has(aid)) continue
      toInsert.push({ meeting_id: meetingId, attendee_id: aid, status: 'present' })
    }

    if (toInsert.length === 0) continue

    const { error: aErr } = await supabase.from('attendance').insert(toInsert)
    if (aErr) { errors++; continue }
    attendanceAdded += toInsert.length
  }

  console.log(`\n\n─────────────────────────────────────────────`)
  console.log(`Done.`)
  console.log(`  Meetings created:    ${meetingsCreated}`)
  console.log(`  Attendance added:    ${attendanceAdded}`)
  console.log(`  Skipped (no match):  ${skipped}`)
  console.log(`  Errors:              ${errors}`)
  console.log(`─────────────────────────────────────────────`)
}

main().catch(err => {
  console.error('\nFatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})

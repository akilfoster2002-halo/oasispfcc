/**
 * Sync all Breeze attendance into Supabase meetings + attendance tables.
 *
 * For each event in Breeze:
 *   1. Upsert a row in `meetings` (keyed on breeze_instance_id)
 *   2. Upsert attendance rows (person_id × meeting_id, present=true)
 *
 * Run:
 *   npx tsx scripts/sync-breeze-attendance.ts [from] [to]
 *
 * Example:
 *   npx tsx scripts/sync-breeze-attendance.ts 2024-01-01 2026-12-31
 *
 * Defaults to the last 18 months if no dates given.
 */

import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'
import { fetchAttendanceByDateRange } from '../lib/breeze'

// ── Load .env.local ──────────────────────────────────────────────────────────
const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Classify Breeze event name → service_type
function classifyServiceType(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('sunday') && (n.includes('online') || n.includes('stream'))) return 'sunday_online'
  if (n.includes('sunday')) return 'sunday_inperson'
  if (n.includes('wednesday') || n.includes('midweek') || n.includes('wed service')) return 'midweek'
  if (n.includes('cell') || n.includes('small group')) return 'cell'
  return 'midweek' // default for service-type events
}

async function main() {
  const now   = new Date()
  const dfrom = process.argv[2] ?? (() => { const d = new Date(now); d.setMonth(d.getMonth() - 18); return d.toISOString().split('T')[0] })()
  const dto   = process.argv[3] ?? now.toISOString().split('T')[0]

  console.log(`Fetching Breeze events from ${dfrom} to ${dto}...`)

  const eventMap = await fetchAttendanceByDateRange(dfrom, dto, (fetched, total) => {
    process.stdout.write(`\r  Processing events: ${fetched}/${total}...`)
  })
  console.log(`\nFound ${eventMap.size} events from Breeze.`)

  // Build a map of breeze_id → supabase people.id
  console.log('Loading people map from Supabase...')
  const { data: peopleRows } = await supabase
    .from('people')
    .select('id, breeze_id')
    .limit(10000)

  const breezeIdToSupabaseId = new Map<number, string>()
  for (const p of (peopleRows ?? []) as { id: string; breeze_id: number }[]) {
    breezeIdToSupabaseId.set(p.breeze_id, p.id)
  }
  console.log(`Loaded ${breezeIdToSupabaseId.size} people.`)

  let meetingsUpserted = 0
  let attendanceUpserted = 0
  let skippedPeople = 0

  for (const [instanceId, { event, personIds }] of eventMap) {
    // 1. Upsert meeting
    const date = event.start_datetime?.split('T')[0] ?? event.start_datetime?.substring(0, 10) ?? dfrom
    const serviceType = classifyServiceType(event.name ?? '')

    const { data: meetingRow, error: mErr } = await supabase
      .from('meetings')
      .upsert({
        breeze_instance_id: instanceId,
        title:        event.name,
        date:         date,
        service_type: serviceType,
      }, { onConflict: 'breeze_instance_id' })
      .select('id')
      .single()

    if (mErr || !meetingRow) {
      console.error(`  Meeting upsert error for "${event.name}": ${mErr?.message}`)
      continue
    }

    meetingsUpserted++
    const meetingId = meetingRow.id as string

    // 2. Upsert attendance rows (only for known people)
    const attRows: { meeting_id: string; person_id: string; present: boolean }[] = []
    for (const breezePersonId of personIds) {
      const supabaseId = breezeIdToSupabaseId.get(Number(breezePersonId))
      if (!supabaseId) { skippedPeople++; continue }
      attRows.push({ meeting_id: meetingId, person_id: supabaseId, present: true })
    }

    if (attRows.length > 0) {
      for (const batch of chunk(attRows, 100)) {
        await supabase
          .from('attendance')
          .upsert(batch, { onConflict: 'meeting_id,person_id' })
      }
      attendanceUpserted += attRows.length
    }

    process.stdout.write(`\r  Meetings: ${meetingsUpserted} | Attendance rows: ${attendanceUpserted} | Skipped: ${skippedPeople}...`)
  }

  console.log('\n\n─────────────────────────────────────────')
  console.log(`Meetings upserted:    ${meetingsUpserted}`)
  console.log(`Attendance upserted:  ${attendanceUpserted}`)
  console.log(`Skipped (no match):   ${skippedPeople} (run sync-breeze-people.ts first to minimize this)`)

  // Verify
  const { count: mCount } = await supabase.from('meetings').select('*', { count: 'exact', head: true })
  const { count: aCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true })
  console.log(`\nTotal meetings in Supabase:    ${mCount}`)
  console.log(`Total attendance rows:         ${aCount}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })

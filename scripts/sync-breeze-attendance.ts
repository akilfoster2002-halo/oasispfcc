/**
 * Sync all Breeze attendance into Supabase (new schema).
 *
 * Run: npx tsx scripts/sync-breeze-attendance.ts [from_date] [to_date]
 *
 * Example:
 *   npx tsx scripts/sync-breeze-attendance.ts 2024-01-01 2026-12-31
 *
 * Defaults to the last 18 months if no dates given.
 */

import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'
import { fetchEvents, fetchEventAttendance, parseBreezeTimestamp } from '../lib/breeze'

// ── Load .env.local ──────────────────────────────────────────
const envPath = path.join(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

// ── Supabase client (service role preferred) ─────────────────
function createSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey) {
    return createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) throw new Error('No Supabase key available (set SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  console.warn('[sync-breeze-attendance] Using anon key — service role key not found.')
  return createClient(url, anonKey)
}

const supabase = createSupabase()

// ── Utility ───────────────────────────────────────────────────
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── Service type classification (matches schema.sql enum) ─────
type ServiceType = 'sunday_inperson' | 'sunday_online' | 'midweek' | 'cell' | 'outreach' | 'prayer' | 'other'

function classifyServiceType(name: string): ServiceType {
  const n = (name ?? '').toLowerCase()
  if (n.includes('sunday') && (n.includes('online') || n.includes('stream'))) return 'sunday_online'
  if (n.includes('sunday')) return 'sunday_inperson'
  if (n.includes('wednesday') || n.includes('midweek') || n.includes('wed')) return 'midweek'
  if (n.includes('cell') || n.includes('small group')) return 'cell'
  if (n.includes('outreach')) return 'outreach'
  if (n.includes('prayer')) return 'prayer'
  return 'other'
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const now = new Date()
  const dfrom = process.argv[2] ?? (() => {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 18)
    return d.toISOString().split('T')[0]
  })()
  const dto = process.argv[3] ?? now.toISOString().split('T')[0]

  console.log(`=== Breeze → Supabase Attendance Sync ===`)
  console.log(`Date range: ${dfrom} → ${dto}`)
  const syncStart = new Date()

  // 1. Resolve church ID
  const churchSlug = process.env.CHURCH_SLUG ?? 'pfcc'
  const { data: church } = await supabase
    .from('churches')
    .select('id, name')
    .eq('slug', churchSlug)
    .single()
  if (!church?.id) throw new Error(`Church "${churchSlug}" not found. Run onboarding first.`)
  const churchId = church.id as string
  console.log(`Church: ${church.name} (${churchId})`)

  // 2. Insert sync_log record
  const { data: syncRow } = await supabase
    .from('sync_log')
    .insert({ church_id: churchId, sync_type: 'attendance', status: 'running' })
    .select('id')
    .single()
  const syncLogId: string | null = syncRow?.id ?? null

  // 3. Fetch all events from Breeze for the date range
  console.log('\nFetching events from Breeze...')
  let events: Awaited<ReturnType<typeof fetchEvents>>
  try {
    events = await fetchEvents(dfrom, dto)
    console.log(`  Found ${events.length} events`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Fatal: failed to fetch Breeze events:', msg)
    if (syncLogId) {
      await supabase.from('sync_log').update({
        status: 'error',
        completed_at: new Date().toISOString(),
        error_message: msg,
      }).eq('id', syncLogId)
    }
    process.exit(1)
  }

  if (events.length === 0) {
    console.log('No events found in range. Exiting.')
    if (syncLogId) {
      await supabase.from('sync_log').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        records_processed: 0,
      }).eq('id', syncLogId)
    }
    return
  }

  // 4. Load groups from Supabase → name→id lookup
  console.log('\nLoading groups...')
  const { data: groupData, error: gErr } = await supabase
    .from('groups')
    .select('id, name')
    .eq('church_id', churchId)
  if (gErr) throw new Error('Failed to load groups: ' + gErr.message)
  const groups = (groupData ?? []) as { id: string; name: string }[]
  const groupNameToId = new Map<string, string>()
  for (const g of groups) groupNameToId.set(g.name, g.id)
  console.log(`  Loaded ${groups.length} groups`)

  // 5. Load cells from Supabase → name→id lookup
  console.log('Loading cells...')
  const { data: cellData, error: cErr } = await supabase
    .from('cells')
    .select('id, name')
    .eq('church_id', churchId)
  if (cErr) throw new Error('Failed to load cells: ' + cErr.message)
  const cells = (cellData ?? []) as { id: string; name: string }[]
  const cellNameToId = new Map<string, string>()
  for (const c of cells) cellNameToId.set(c.name, c.id)
  console.log(`  Loaded ${cells.length} cells`)

  // 6. Load people from Supabase → breeze_id→uuid map
  console.log('Loading people...')
  const breezeIdToUuid = new Map<string, string>()
  let offset = 0
  const pageSize = 1000
  while (true) {
    const { data: rows, error: pErr } = await supabase
      .from('people')
      .select('id, breeze_id')
      .eq('church_id', churchId)
      .range(offset, offset + pageSize - 1)
    if (pErr) throw new Error('Failed to load people: ' + pErr.message)
    if (!rows || rows.length === 0) break
    for (const row of rows as { id: string; breeze_id: number }[]) {
      breezeIdToUuid.set(String(row.breeze_id), row.id)
    }
    if (rows.length < pageSize) break
    offset += pageSize
  }
  console.log(`  Loaded ${breezeIdToUuid.size} people`)

  // 7. Process events
  let eventsUpserted = 0
  let attendanceUpserted = 0
  let skippedPeople = 0
  let eventErrors = 0

  console.log('\nProcessing events...')
  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    process.stdout.write(`\r  Event ${i + 1}/${events.length}: ${event.name.substring(0, 40).padEnd(40)}`)

    // Classify service type
    const serviceType = classifyServiceType(event.name)

    // Parse event date
    const eventDate = event.start_datetime?.split('T')[0]
      ?? event.start_datetime?.substring(0, 10)
      ?? dfrom

    // Determine group_id: substring match against known group names (case-insensitive)
    let groupId: string | null = null
    const eventNameLower = event.name.toLowerCase()
    for (const [gName, gId] of groupNameToId.entries()) {
      if (eventNameLower.includes(gName.toLowerCase())) {
        groupId = gId
        break
      }
    }

    // Determine cell_id: if cell service_type, match cell name against event name
    let cellId: string | null = null
    if (serviceType === 'cell') {
      for (const [cName, cId] of cellNameToId.entries()) {
        if (eventNameLower.includes(cName.toLowerCase())) {
          cellId = cId
          break
        }
      }
    }

    // Upsert event
    const { data: eventRow, error: evErr } = await supabase
      .from('events')
      .upsert({
        church_id:          churchId,
        breeze_instance_id: event.id,
        breeze_event_id:    event.event_id,
        name:               event.name,
        service_type:       serviceType,
        event_date:         eventDate,
        event_datetime:     event.start_datetime ?? null,
        group_id:           groupId,
        cell_id:            cellId,
        hybrid_status:      'inperson',
      }, { onConflict: 'breeze_instance_id' })
      .select('id')
      .single()

    if (evErr || !eventRow) {
      console.error(`\n  Event upsert error for "${event.name}": ${evErr?.message}`)
      eventErrors++
      continue
    }
    eventsUpserted++
    const eventId = eventRow.id as string

    // Fetch attendance from Breeze
    let breezeRecords: Awaited<ReturnType<typeof fetchEventAttendance>>
    try {
      breezeRecords = await fetchEventAttendance(event.id)
    } catch {
      // Non-fatal: skip attendance for this event
      continue
    }

    if (breezeRecords.length === 0) continue

    // Map breeze_ids to Supabase UUIDs, capturing check_in_time from created_on
    const attRows: {
      church_id: string
      person_id: string
      event_id: string
      attendance_status: string
      check_in_time: string | null
      imported_from_breeze: boolean
    }[] = []
    for (const rec of breezeRecords) {
      const uuid = breezeIdToUuid.get(rec.person_id)
      if (!uuid) { skippedPeople++; continue }
      attRows.push({
        church_id:            churchId,
        person_id:            uuid,
        event_id:             eventId,
        attendance_status:    'present',
        check_in_time:        parseBreezeTimestamp(rec.created_on),
        imported_from_breeze: true,
      })
    }

    // Bulk upsert attendance in batches of 100
    for (const batch of chunk(attRows, 100)) {
      const { error: aErr } = await supabase
        .from('attendance')
        .upsert(batch, { onConflict: 'person_id,event_id', ignoreDuplicates: true })
      if (aErr) {
        console.error(`\n  Attendance upsert error: ${aErr.message}`)
      } else {
        attendanceUpserted += batch.length
      }
    }
  }

  // 8. Update sync_log
  const completed = new Date()
  const duration  = ((completed.getTime() - syncStart.getTime()) / 1000).toFixed(1)
  if (syncLogId) {
    await supabase.from('sync_log').update({
      status: 'completed',
      completed_at: completed.toISOString(),
      records_processed: events.length,
      records_created: eventsUpserted,
    }).eq('id', syncLogId)
  }

  // 9. Summary
  const { count: evCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
  const { count: aCount } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })

  console.log('\n\n─────────────────────────────────────────────')
  console.log(`Sync completed in ${duration}s`)
  console.log(`  Events processed:    ${events.length}`)
  console.log(`  Events upserted:     ${eventsUpserted}`)
  console.log(`  Attendance upserted: ${attendanceUpserted}`)
  console.log(`  Skipped (no match):  ${skippedPeople}`)
  console.log(`  Event errors:        ${eventErrors}`)
  console.log(`  Total events in DB:  ${evCount}`)
  console.log(`  Total attendance:    ${aCount}`)
  console.log('─────────────────────────────────────────────')
  if (skippedPeople > 0) {
    console.log('\n  Tip: run sync-breeze-people.ts first to reduce skipped people.')
  }
}

main().catch(err => {
  console.error('Fatal error:', err instanceof Error ? err.message : err)
  process.exit(1)
})

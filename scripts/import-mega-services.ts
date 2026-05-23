#!/usr/bin/env npx tsx
/**
 * Import MEGA 2026 service events, people, and attendance from CSV,
 * then create recurring event_series for each service type.
 * Run: npx tsx scripts/import-mega-services.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const CHURCH_ID = 'fd2c3d24-ec10-4c9c-bbd1-bef58903d121'
const CSV_PATH  = resolve(process.cwd(), 'data/MEGA 2026 services - Attendance.csv')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let i = 0
  while (i <= line.length) {
    if (i === line.length) { result.push(''); break }
    if (line[i] === '"') {
      let field = ''
      i++
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2 }
        else if (line[i] === '"') { i++; break }
        else field += line[i++]
      }
      result.push(field)
      if (line[i] === ',') i++
    } else {
      let field = ''
      while (i < line.length && line[i] !== ',') field += line[i++]
      result.push(field)
      if (line[i] === ',') i++
    }
  }
  return result
}

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}
const MONTH_PAD = ['01','02','03','04','05','06','07','08','09','10','11','12']
const DOW_UPPER = ['SUN','MON','TUE','WED','THU','FRI','SAT']

function parseDate(s: string): { iso: string; dow: string } | null {
  const m = s.trim().match(/^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/)
  if (!m) return null
  const mo = MONTHS[m[1]]
  if (mo === undefined) return null
  const d = new Date(parseInt(m[3]), mo, parseInt(m[2]))
  return {
    iso: `${m[3]}-${MONTH_PAD[mo]}-${m[2].padStart(2, '0')}`,
    dow: DOW_UPPER[d.getDay()],
  }
}

// ── Service name → DB service_type ───────────────────────────────────────────

const SERVICE_TYPE_MAP: Record<string, string> = {
  'oasis mega sunday service': 'sunday_inperson',
  'mega midweek service':      'midweek',
  'oasis mega online service': 'sunday_online',
}

interface ColDef { iso: string; dow: string; serviceName: string; serviceType: string }

function parseHeader(cols: string[]): (ColDef | null)[] {
  return cols.map(col => {
    const m = col.match(/^(.+?)\s*\((.+)\)$/)
    if (!m) return null
    const parsed = parseDate(m[1].trim())
    if (!parsed) return null
    const serviceName = m[2].trim()
    const serviceType = SERVICE_TYPE_MAP[serviceName.toLowerCase()]
    if (!serviceType) return null
    return { ...parsed, serviceName, serviceType }
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const raw   = readFileSync(CSV_PATH, 'utf-8')
  const lines = raw.split('\n').map(l => l.trimEnd()).filter(l => l)
  console.log(`Parsed ${lines.length} lines from services CSV`)

  const header  = parseCSVLine(lines[0])
  const colDefs = parseHeader(header.slice(3, -1))

  const validCols = colDefs.filter(Boolean) as ColDef[]
  console.log(`\nFound ${validCols.length} service event columns`)

  // Unique service names and their stats
  const serviceStats = new Map<string, { first: string; last: string; dow: string; serviceType: string }>()
  for (const c of validCols) {
    const s = serviceStats.get(c.serviceName)
    if (!s) {
      serviceStats.set(c.serviceName, { first: c.iso, last: c.iso, dow: c.dow, serviceType: c.serviceType })
    } else {
      if (c.iso < s.first) s.first = c.iso
      if (c.iso > s.last)  s.last  = c.iso
    }
  }

  console.log('\nService types found:')
  for (const [name, stats] of serviceStats) {
    console.log(`  ${name} (${stats.serviceType}) → ${stats.dow}, ${stats.first}–${stats.last}`)
  }

  // ── 1. Load MEGA group ────────────────────────────────────────────────────

  const { data: groups } = await supabase.from('groups').select('id, name').eq('church_id', CHURCH_ID)
  const megaGroup = groups?.find(g => g.name.toLowerCase().includes('mega'))
  if (!megaGroup) throw new Error('BLW Oasis MEGA group not found')
  console.log(`\nGroup: ${megaGroup.name} (${megaGroup.id})`)

  // ── 2. Create / update event_series (one per service type) ───────────────

  console.log('\nEnsuring event series exist…')

  const { data: existingSeries } = await supabase
    .from('event_series')
    .select('id, name')
    .eq('church_id', CHURCH_ID)
    .is('cell_id', null)

  const seriesByName = new Map<string, string>() // service name (lower) → series id
  for (const s of existingSeries ?? []) {
    seriesByName.set(s.name.toLowerCase(), s.id)
  }

  const seriesMap = new Map<string, string>() // service name (lower) → series id

  for (const [serviceName, stats] of serviceStats) {
    const lower = serviceName.toLowerCase()

    if (seriesByName.has(lower)) {
      const sid = seriesByName.get(lower)!
      seriesMap.set(lower, sid)
      await supabase.from('event_series')
        .update({ end_date: stats.last, end_type: 'on_date' })
        .eq('id', sid)
      console.log(`  ↺ Updated series: ${serviceName} → ends ${stats.last}`)
      continue
    }

    const { data, error } = await supabase.from('event_series').insert({
      church_id:           CHURCH_ID,
      group_id:            megaGroup.id,
      cell_id:             null,
      name:                serviceName,
      service_type:        stats.serviceType,
      recurrence_type:     'weekly',
      recurrence_interval: 1,
      recurrence_days:     [stats.dow],
      end_type:            'on_date',
      end_date:            stats.last,
    }).select('id').single()

    if (error) { console.error(`  ✗ Series for ${serviceName}: ${error.message}`); continue }
    seriesMap.set(lower, data.id)
    console.log(`  + Series: ${serviceName} (${stats.dow}, ${stats.first}–${stats.last})`)
  }

  // ── 3. Ensure events exist ────────────────────────────────────────────────

  console.log('\nEnsuring events exist…')

  // Load existing events for MEGA group (no cell) in the date range
  const allDates = validCols.map(c => c.iso)
  const minDate  = allDates.reduce((a, b) => a < b ? a : b)
  const maxDate  = allDates.reduce((a, b) => a > b ? a : b)

  const { data: existingEvents } = await supabase
    .from('events')
    .select('id, name, event_date, series_id')
    .eq('church_id', CHURCH_ID)
    .eq('group_id', megaGroup.id)
    .is('cell_id', null)
    .gte('event_date', minDate)
    .lte('event_date', maxDate)

  const eventLookup = new Map<string, string>()  // "serviceName:date" → event id
  const needsSeries: { id: string; series_id: string }[] = []

  for (const e of existingEvents ?? []) {
    const key      = `${e.name.toLowerCase()}:${e.event_date}`
    const seriesId = seriesMap.get(e.name.toLowerCase())
    eventLookup.set(key, e.id)
    if (seriesId && e.series_id !== seriesId) needsSeries.push({ id: e.id, series_id: seriesId })
  }

  if (needsSeries.length) {
    console.log(`  Linking ${needsSeries.length} existing events to their series…`)
    for (const { id, series_id } of needsSeries) {
      await supabase.from('events').update({ series_id }).eq('id', id)
    }
  }

  // Determine which events are missing
  const toInsert: Record<string, object> = {}
  for (const c of validCols) {
    const lower     = c.serviceName.toLowerCase()
    const seriesId  = seriesMap.get(lower)
    const key       = `${lower}:${c.iso}`
    if (!eventLookup.has(key) && !toInsert[key]) {
      toInsert[key] = {
        church_id:    CHURCH_ID,
        group_id:     megaGroup.id,
        cell_id:      null,
        series_id:    seriesId ?? null,
        name:         c.serviceName,
        service_type: c.serviceType,
        event_date:   c.iso,
      }
    }
  }

  const insertRows = Object.values(toInsert)
  let evInserted   = 0
  for (let i = 0; i < insertRows.length; i += 100) {
    const batch = insertRows.slice(i, i + 100)
    const { data: inserted, error } = await supabase.from('events').insert(batch).select('id, name, event_date')
    if (error) { console.error(`  Event batch error: ${error.message}`); continue }
    for (const e of inserted ?? []) {
      eventLookup.set(`${e.name.toLowerCase()}:${e.event_date}`, e.id)
    }
    evInserted += batch.length
  }
  console.log(`  ${evInserted} new events inserted, ${needsSeries.length} linked to series.`)

  // ── 4. Upsert people ──────────────────────────────────────────────────────

  console.log('\nUpserting people…')

  interface PersonRow { breezeId: number; firstName: string; lastName: string }
  const personRows: PersonRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols     = parseCSVLine(lines[i])
    if (cols.length < 4) continue
    const breezeId = parseInt(cols[0], 10)
    if (isNaN(breezeId)) continue
    const firstName = cols[1]?.trim() || ''
    let   lastName  = cols[2]?.trim() || ''
    if (lastName === ',' || lastName === '#' || lastName.startsWith('.')) lastName = ''
    personRows.push({ breezeId, firstName, lastName })
  }

  const personIdMap = new Map<number, string>()
  let   peopleUpserted = 0

  for (let i = 0; i < personRows.length; i += 50) {
    const batch = personRows.slice(i, i + 50)
    const { data, error } = await supabase.from('people').upsert(
      batch.map(r => ({ church_id: CHURCH_ID, breeze_id: r.breezeId, first_name: r.firstName, last_name: r.lastName })),
      { onConflict: 'church_id,breeze_id' },
    ).select('id, breeze_id')
    if (error) { console.error(`  People batch error: ${error.message}`); continue }
    for (const p of data ?? []) personIdMap.set(p.breeze_id, p.id)
    peopleUpserted += batch.length
    process.stdout.write(`\r  Upserted ${peopleUpserted}/${personRows.length} people…`)
  }
  console.log()

  // ── 5. Collect and insert attendance ──────────────────────────────────────

  console.log('\nProcessing attendance…')

  const attRows: { church_id: string; person_id: string; event_id: string; attendance_status: string }[] = []

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const cols     = parseCSVLine(lines[rowIdx])
    if (cols.length < 4) continue
    const breezeId = parseInt(cols[0], 10)
    if (isNaN(breezeId)) continue
    const personId = personIdMap.get(breezeId)
    if (!personId) continue

    const attCols = cols.slice(3, -1)
    for (let ci = 0; ci < attCols.length; ci++) {
      if (attCols[ci].trim().toUpperCase() !== 'X') continue
      const colDef = colDefs[ci]
      if (!colDef) continue
      const eventId = eventLookup.get(`${colDef.serviceName.toLowerCase()}:${colDef.iso}`)
      if (!eventId) continue
      attRows.push({ church_id: CHURCH_ID, person_id: personId, event_id: eventId, attendance_status: 'present' })
    }
  }

  // Deduplicate against existing attendance
  const eventIds = [...new Set(attRows.map(r => r.event_id))]
  const { data: existingAtt } = await supabase
    .from('attendance')
    .select('person_id, event_id')
    .eq('church_id', CHURCH_ID)
    .in('event_id', eventIds)

  const existingKeys = new Set((existingAtt ?? []).map(a => `${a.person_id}:${a.event_id}`))
  const newAtt       = attRows.filter(r => !existingKeys.has(`${r.person_id}:${r.event_id}`))

  let attInserted = 0
  for (let i = 0; i < newAtt.length; i += 500) {
    const batch = newAtt.slice(i, i + 500)
    const { error } = await supabase.from('attendance').insert(batch)
    if (error) { console.error(`  Attendance batch error: ${error.message}`); continue }
    attInserted += batch.length
    process.stdout.write(`\r  Inserted ${attInserted}/${newAtt.length} attendance records…`)
  }
  console.log()

  console.log(`
✅ Import complete!
   People:     ${peopleUpserted} upserted
   Events:     ${evInserted} new + ${needsSeries.length} linked to series
   Attendance: ${attInserted} new records (${existingKeys.size} already existed)
`)
}

run().catch(err => { console.error(err); process.exit(1) })

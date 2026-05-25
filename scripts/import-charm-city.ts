#!/usr/bin/env npx tsx
/**
 * Import Charm City cells, events, people, and attendance from CSV.
 * Run: npx tsx scripts/import-charm-city.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const CHURCH_ID  = 'fd2c3d24-ec10-4c9c-bbd1-bef58903d121'
const GROUP_ID   = '5749fac4-7ccc-4bbb-9b81-67524c7bd99c'  // BLW Oasis Charm City
const CSV_PATH   = resolve(process.cwd(), 'data/Charm City - Attendance.csv')

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

// ── Date parser ───────────────────────────────────────────────────────────────

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}

function parseDate(s: string): string | null {
  const m = s.trim().match(/^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/)
  if (!m) return null
  const mo = MONTHS[m[1]]
  if (!mo) return null
  return `${m[3]}-${mo}-${m[2].padStart(2, '0')}`
}

// ── Event classification ──────────────────────────────────────────────────────

function classifyEvent(name: string): { serviceType: string; isService: boolean } {
  const n = name.toLowerCase()
  if (n.includes('sunday service'))  return { serviceType: 'sunday_inperson', isService: true }
  if (n.includes('wed service'))     return { serviceType: 'midweek',          isService: true }
  if (n.includes('faith fusion'))    return { serviceType: 'other',            isService: true }
  return { serviceType: 'cell', isService: false }
}

// ── Header → columns ──────────────────────────────────────────────────────────

interface ColDef { date: string; eventName: string; serviceType: string; isService: boolean }

function parseHeader(cols: string[]): (ColDef | null)[] {
  return cols.map(col => {
    const m = col.match(/^(.+?)\s*\((.+)\)$/)
    if (!m) return null
    const date = parseDate(m[1].trim())
    if (!date) return null
    const eventName = m[2].trim()
    return { date, eventName, ...classifyEvent(eventName) }
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const raw   = readFileSync(CSV_PATH, 'utf-8')
  const lines = raw.split('\n').map(l => l.trimEnd()).filter(l => l)
  console.log(`Parsed ${lines.length} lines from CSV`)

  const header  = parseCSVLine(lines[0])
  // First 3 cols: Breeze ID, First Name, Last Name — last col: Person Totals
  const colDefs = parseHeader(header.slice(3, -1))

  const uniqueCellNames    = [...new Set(colDefs.filter(c => c && !c.isService).map(c => c!.eventName))]
  const uniqueServiceNames = [...new Set(colDefs.filter(c => c &&  c.isService).map(c => c!.eventName))]
  console.log(`\nCell events (${uniqueCellNames.length}):`)
  uniqueCellNames.forEach(n => console.log(`  - ${n}`))
  console.log(`\nService events (${uniqueServiceNames.length}):`)
  uniqueServiceNames.forEach(n => console.log(`  - ${n}`))

  // ── 1. Upsert cells ──────────────────────────────────────────────────────────
  console.log('\nUpserting cells…')
  const { data: existingCells } = await supabase
    .from('cells')
    .select('id, name')
    .eq('church_id', CHURCH_ID)

  const cellMap = new Map<string, string>() // normalised name → id
  for (const c of existingCells ?? []) {
    cellMap.set(c.name.toLowerCase(), c.id)
  }

  for (const cellName of uniqueCellNames) {
    const lower = cellName.toLowerCase()
    if (cellMap.has(lower)) {
      console.log(`  ✓ Matched: "${cellName}" → existing`)
      continue
    }
    const { data, error } = await supabase
      .from('cells')
      .insert({
        church_id: CHURCH_ID,
        group_id:  GROUP_ID,
        name:      cellName,
        is_active: true,
        color:     '#C9A84C',
      })
      .select('id')
      .single()

    if (error) console.error(`  ✗ Failed to create cell "${cellName}": ${error.message}`)
    else { cellMap.set(lower, data.id); console.log(`  + Created: "${cellName}"`) }
  }

  // ── 2. Upsert events ─────────────────────────────────────────────────────────
  console.log('\nUpserting events…')

  const cellIds = [...new Set([...cellMap.values()])]
  const { data: existingCellEvents } = await supabase
    .from('events')
    .select('id, cell_id, event_date')
    .eq('church_id', CHURCH_ID)
    .in('cell_id', cellIds.length > 0 ? cellIds : ['none'])

  const { data: existingServiceEvents } = await supabase
    .from('events')
    .select('id, name, event_date')
    .eq('church_id', CHURCH_ID)
    .eq('group_id', GROUP_ID)
    .is('cell_id', null)

  const existingCellEventKeys = new Set(
    (existingCellEvents ?? []).map(e => `${e.cell_id}:${e.event_date}`)
  )
  const existingServiceKeys = new Set(
    (existingServiceEvents ?? []).map(e => `${e.name.toLowerCase()}:${e.event_date}`)
  )

  type EventInsert = {
    church_id: string; name: string; service_type: string
    event_date: string; group_id: string; cell_id?: string
  }
  const eventInserts: Record<string, EventInsert> = {}

  for (const colDef of colDefs) {
    if (!colDef) continue
    const { date, eventName, serviceType, isService } = colDef

    if (isService) {
      const key = `${eventName.toLowerCase()}:${date}`
      if (!existingServiceKeys.has(key) && !eventInserts[key]) {
        eventInserts[key] = { church_id: CHURCH_ID, name: eventName, service_type: serviceType, event_date: date, group_id: GROUP_ID }
      }
    } else {
      const cellId = cellMap.get(eventName.toLowerCase())
      if (!cellId) continue
      const key = `${cellId}:${date}`
      if (!existingCellEventKeys.has(key) && !eventInserts[key]) {
        eventInserts[key] = { church_id: CHURCH_ID, name: eventName, service_type: 'cell', event_date: date, group_id: GROUP_ID, cell_id: cellId }
      }
    }
  }

  const eventRows = Object.values(eventInserts)
  let eventsInserted = 0
  for (let i = 0; i < eventRows.length; i += 100) {
    const batch = eventRows.slice(i, i + 100)
    const { error } = await supabase.from('events').insert(batch)
    if (error) console.error(`  Event batch error: ${error.message}`)
    else eventsInserted += batch.length
    process.stdout.write(`\r  Inserted ${eventsInserted}/${eventRows.length} events…`)
  }
  console.log(`\n  Done — ${eventsInserted} new events.`)

  // Build fresh event lookup
  const { data: allCellEvents } = await supabase
    .from('events').select('id, cell_id, event_date')
    .eq('church_id', CHURCH_ID).in('cell_id', cellIds.length > 0 ? cellIds : ['none'])

  const { data: allServiceEvents } = await supabase
    .from('events').select('id, name, event_date')
    .eq('church_id', CHURCH_ID).eq('group_id', GROUP_ID).is('cell_id', null)

  const eventLookup = new Map<string, string>()
  for (const e of allCellEvents ?? [])    eventLookup.set(`${e.cell_id}:${e.event_date}`, e.id)
  for (const e of allServiceEvents ?? []) eventLookup.set(`${(e.name as string).toLowerCase()}:${e.event_date}`, e.id)

  // ── 3. Upsert people & collect attendance ─────────────────────────────────────
  console.log('\nUpserting people and recording attendance…')

  const attendanceRows: { church_id: string; person_id: string; event_id: string; attendance_status: string }[] = []
  let peopleUpserted = 0

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const cols = parseCSVLine(lines[rowIdx])
    if (cols.length < 4) continue

    const breezeId  = parseInt(cols[0], 10)
    const firstName = cols[1]?.trim() || ''
    let   lastName  = cols[2]?.trim() || ''
    if (lastName === ',' || lastName === '#') lastName = ''
    if (isNaN(breezeId)) continue

    const { data: personData, error: personErr } = await supabase
      .from('people')
      .upsert(
        { church_id: CHURCH_ID, breeze_id: breezeId, first_name: firstName, last_name: lastName },
        { onConflict: 'church_id,breeze_id', ignoreDuplicates: false },
      )
      .select('id')
      .single()

    if (personErr || !personData) {
      console.error(`\n  ✗ Person upsert failed (${firstName} ${lastName}): ${personErr?.message}`)
      continue
    }
    peopleUpserted++

    const attendanceCols = cols.slice(3, -1)
    for (let ci = 0; ci < attendanceCols.length; ci++) {
      if (attendanceCols[ci].trim().toUpperCase() !== 'X') continue
      const colDef = colDefs[ci]
      if (!colDef) continue

      let eventId: string | undefined
      if (colDef.isService) {
        eventId = eventLookup.get(`${colDef.eventName.toLowerCase()}:${colDef.date}`)
      } else {
        const cellId = cellMap.get(colDef.eventName.toLowerCase())
        if (cellId) eventId = eventLookup.get(`${cellId}:${colDef.date}`)
      }

      if (!eventId) continue
      attendanceRows.push({ church_id: CHURCH_ID, person_id: personData.id, event_id: eventId, attendance_status: 'present' })
    }

    process.stdout.write(`\r  Processed ${peopleUpserted} people…`)
  }
  console.log(`\n  Done — ${peopleUpserted} people upserted, ${attendanceRows.length} attendance records queued.`)

  // ── 4. Insert attendance ──────────────────────────────────────────────────────
  console.log('\nInserting attendance records…')

  const { data: existingAtt } = await supabase
    .from('attendance')
    .select('person_id, event_id')
    .eq('church_id', CHURCH_ID)
    .in('event_id', [...new Set(attendanceRows.map(r => r.event_id))])

  const existingAttKeys = new Set((existingAtt ?? []).map(a => `${a.person_id}:${a.event_id}`))
  const newAttendance   = attendanceRows.filter(r => !existingAttKeys.has(`${r.person_id}:${r.event_id}`))

  let attInserted = 0
  for (let i = 0; i < newAttendance.length; i += 500) {
    const batch = newAttendance.slice(i, i + 500)
    const { error } = await supabase.from('attendance').insert(batch)
    if (error) console.error(`  Attendance batch error: ${error.message}`)
    else attInserted += batch.length
    process.stdout.write(`\r  Inserted ${attInserted}/${newAttendance.length} records…`)
  }
  console.log(`\n  Done — ${attInserted} attendance records inserted.`)

  console.log('\n✅ Import complete!')
}

run().catch(err => { console.error(err); process.exit(1) })

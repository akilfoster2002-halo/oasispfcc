#!/usr/bin/env npx tsx
/**
 * Import MEGA cells, events, people, and attendance from CSV.
 * Run: npx tsx scripts/import-csv-attendance.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const CHURCH_ID = 'fd2c3d24-ec10-4c9c-bbd1-bef58903d121'
const CSV_PATH = resolve(process.cwd(), 'data/2026 Mega Cells Updated - Attendance.csv')

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

// ── Header → columns ──────────────────────────────────────────────────────────

interface ColDef { date: string; cellName: string }

function parseHeader(cols: string[]): (ColDef | null)[] {
  return cols.map(col => {
    const m = col.match(/^(.+?)\s*\((.+)\)$/)
    if (!m) return null
    const date = parseDate(m[1].trim())
    if (!date) return null
    return { date, cellName: m[2].trim() }
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const raw = readFileSync(CSV_PATH, 'utf-8')
  const lines = raw.split('\n').map(l => l.trimEnd()).filter(l => l)
  console.log(`Parsed ${lines.length} lines from CSV`)

  // Parse header
  const header = parseCSVLine(lines[0])
  // First 3 cols: Breeze ID, First Name, Last Name
  // Last col: Person Totals
  const colDefs = parseHeader(header.slice(3, -1))
  const uniqueCellNames = [...new Set(colDefs.filter(Boolean).map(c => c!.cellName))]
  console.log(`\nFound ${uniqueCellNames.length} unique cells:`)
  uniqueCellNames.forEach(n => console.log(`  - ${n}`))

  // ── 1. Get MEGA group ────────────────────────────────────────────────────────
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name')
    .eq('church_id', CHURCH_ID)
  const megaGroup = groups?.find(g => g.name.toLowerCase().includes('mega'))
  if (!megaGroup) throw new Error('BLW Oasis MEGA group not found in DB')
  console.log(`\nMEGA group: ${megaGroup.name} (${megaGroup.id})`)

  // ── 2. Upsert cells ──────────────────────────────────────────────────────────
  console.log('\nUpserting cells…')
  const { data: existingCells } = await supabase
    .from('cells')
    .select('id, name')
    .eq('church_id', CHURCH_ID)

  const cellMap = new Map<string, string>() // name → id

  // Load existing cells (normalize names for matching)
  for (const c of existingCells ?? []) {
    cellMap.set(c.name.toLowerCase(), c.id)
  }

  // Known name aliases (CSV name → existing DB name)
  const ALIASES: Record<string, string> = {
    'oasis @rit': 'blw oasis rit',
  }

  for (const cellName of uniqueCellNames) {
    const lower = cellName.toLowerCase()
    const alias = ALIASES[lower]
    const lookupKey = alias ?? lower

    if (cellMap.has(lookupKey)) {
      const existingId = cellMap.get(lookupKey)!
      cellMap.set(lower, existingId) // also register original name
      console.log(`  ✓ Matched: "${cellName}" → existing`)
      continue
    }

    const { data, error } = await supabase
      .from('cells')
      .insert({
        church_id: CHURCH_ID,
        group_id: megaGroup.id,
        name: cellName,
        is_active: true,
        color: '#C9A84C',
      })
      .select('id')
      .single()

    if (error) {
      console.error(`  ✗ Failed to create cell "${cellName}": ${error.message}`)
    } else {
      cellMap.set(lower, data.id)
      console.log(`  + Created: "${cellName}"`)
    }
  }

  // ── 3. Upsert events ─────────────────────────────────────────────────────────
  console.log('\nUpserting events…')

  // Fetch existing events for these cells to avoid duplicates
  const cellIds = [...new Set([...cellMap.values()])]
  const { data: existingEvents } = await supabase
    .from('events')
    .select('id, cell_id, event_date')
    .eq('church_id', CHURCH_ID)
    .in('cell_id', cellIds)

  const existingEventKeys = new Set(
    (existingEvents ?? []).map(e => `${e.cell_id}:${e.event_date}`)
  )

  // Build list of events to insert
  const eventInserts: Record<string, { church_id: string; name: string; service_type: string; event_date: string; group_id: string; cell_id: string }> = {}

  for (const colDef of colDefs) {
    if (!colDef) continue
    const { date, cellName } = colDef
    const cellId = cellMap.get(cellName.toLowerCase())
    if (!cellId) continue
    const key = `${cellId}:${date}`
    if (!existingEventKeys.has(key) && !eventInserts[key]) {
      eventInserts[key] = {
        church_id: CHURCH_ID,
        name: cellName,
        service_type: 'cell',
        event_date: date,
        group_id: megaGroup.id,
        cell_id: cellId,
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

  // Build a fresh event lookup: cellId:date → event id
  const { data: allEvents } = await supabase
    .from('events')
    .select('id, cell_id, event_date')
    .eq('church_id', CHURCH_ID)
    .in('cell_id', cellIds)

  const eventLookup = new Map<string, string>()
  for (const e of allEvents ?? []) {
    eventLookup.set(`${e.cell_id}:${e.event_date}`, e.id)
  }

  // ── 4. Upsert people & collect attendance ────────────────────────────────────
  console.log('\nUpserting people and recording attendance…')

  const attendanceRows: { church_id: string; person_id: string; event_id: string; attendance_status: string }[] = []
  let peopleUpserted = 0

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const cols = parseCSVLine(lines[rowIdx])
    if (cols.length < 4) continue

    const breezeId = parseInt(cols[0], 10)
    const firstName = cols[1]?.trim() || ''
    let lastName = cols[2]?.trim() || ''
    // Clean placeholder last names
    if (lastName === ',' || lastName === '#' || lastName === '') lastName = ''

    if (isNaN(breezeId)) continue

    // Upsert person
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

    // Collect attendance (columns 3 to n-1, skipping last "Person Totals" col)
    const attendanceCols = cols.slice(3, -1)
    for (let ci = 0; ci < attendanceCols.length; ci++) {
      if (attendanceCols[ci].trim().toUpperCase() !== 'X') continue
      const colDef = colDefs[ci]
      if (!colDef) continue
      const cellId = cellMap.get(colDef.cellName.toLowerCase())
      if (!cellId) continue
      const eventId = eventLookup.get(`${cellId}:${colDef.date}`)
      if (!eventId) continue
      attendanceRows.push({
        church_id: CHURCH_ID,
        person_id: personData.id,
        event_id: eventId,
        attendance_status: 'present',
      })
    }

    process.stdout.write(`\r  Processed ${peopleUpserted} people…`)
  }
  console.log(`\n  Done — ${peopleUpserted} people upserted, ${attendanceRows.length} attendance records queued.`)

  // ── 5. Insert attendance ─────────────────────────────────────────────────────
  console.log('\nInserting attendance records…')

  // Fetch existing attendance to avoid duplicates
  const { data: existingAttendance } = await supabase
    .from('attendance')
    .select('person_id, event_id')
    .eq('church_id', CHURCH_ID)
    .in('event_id', [...new Set(attendanceRows.map(r => r.event_id))])

  const existingAttKeys = new Set(
    (existingAttendance ?? []).map(a => `${a.person_id}:${a.event_id}`)
  )

  const newAttendance = attendanceRows.filter(
    r => !existingAttKeys.has(`${r.person_id}:${r.event_id}`)
  )

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

/**
 * Cell meeting attendance import script
 *
 * Setup:
 *   1. Run db/004_cell_service_type.sql in Supabase SQL Editor
 *   2. Ensure "megacells - Attendance.csv" is in the data/ folder
 *   3. Run: npx tsx scripts/import-cells.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'

// ── Load .env.local ──────────────────────────────────────────────────────────
const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Types ────────────────────────────────────────────────────────────────────
interface MeetingInfo {
  dateISO: string   // "2025-04-01T12:00:00+00:00"
  dayKey:  string   // "2025-04-01"
  title:   string   // "The Oasis @ York Cell Meeting"
}

const SKIP = new Set(['Breeze ID', 'First Name', 'Last Name', 'Person Totals'])

// ── CSV parser (handles quoted fields containing commas) ─────────────────────
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim()); current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim())
  const headers = parseCSVLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = values[i] ?? '' })
    return obj
  })
}

// ── Parse column key: "Apr 1, 2025 (The Oasis @ York Cell Meeting)" ──────────
function parseKey(key: string): MeetingInfo | null {
  const m = key.match(/^(.+?)\s+\((.+)\)$/)
  if (!m) return null
  const [, dateStr, title] = m

  const d = new Date(`${dateStr} 12:00:00 GMT+0000`)
  if (isNaN(d.getTime())) return null

  const pad = (n: number) => String(n).padStart(2, '0')
  const y  = d.getUTCFullYear()
  const mo = pad(d.getUTCMonth() + 1)
  const dy = pad(d.getUTCDate())
  const dayKey = `${y}-${mo}-${dy}`

  return {
    dateISO: `${dayKey}T12:00:00+00:00`,
    dayKey,
    title,
  }
}

function buildName(first: string, last: string): { first: string; last: string; full: string } {
  const f = first.trim()
  const l = /^[A-Za-z][A-Za-z\-' ]*$/.test(last.trim()) ? last.trim() : ''
  return { first: f, last: l, full: l ? `${f} ${l}` : f }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const fileName = process.argv[2] || 'megacells.attendance.csv'
  const filePath = path.join(process.cwd(), 'data', fileName)
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: data/${fileName}`)
    process.exit(1)
  }

  console.log(`Reading ${filePath}`)
  const data = parseCSV(fs.readFileSync(filePath, 'utf8'))
  console.log(`${data.length} people in export\n`)

  // ── Step 1: Collect unique cell meetings ─────────────────────────────────
  const meetingsByKey = new Map<string, MeetingInfo>()
  for (const person of data) {
    for (const key of Object.keys(person)) {
      if (SKIP.has(key)) continue
      const info = parseKey(key)
      if (info) meetingsByKey.set(`${info.dayKey}||${info.title}`, info)
    }
  }

  const allMeetings = Array.from(meetingsByKey.values())
  console.log(`Found ${allMeetings.length} unique cell sessions`)

  // ── Step 2: Upsert meetings ───────────────────────────────────────────────
  let upsertErrors = 0
  for (const batch of chunk(allMeetings, 100)) {
    const { error } = await supabase
      .from('meetings')
      .upsert(
        batch.map(m => ({ title: m.title, date: m.dateISO, service_type: 'cell' })),
        { onConflict: 'date,title' }
      )
    if (error) {
      console.error('  Meeting upsert error:', error.message)
      if (error.message.includes('constraint') || error.message.includes('check')) {
        console.error('  → Make sure you ran db/004_cell_service_type.sql in Supabase first.')
      }
      upsertErrors++
    }
  }
  if (upsertErrors > 0) {
    console.error(`${upsertErrors} batch errors — aborting.`)
    process.exit(1)
  }

  // ── Step 3: Fetch meeting IDs ─────────────────────────────────────────────
  const allTitles = [...new Set(allMeetings.map(m => m.title))]
  const { data: dbMeetings, error: fetchErr } = await supabase
    .from('meetings')
    .select('id, date, title')
    .in('title', allTitles)
    .eq('service_type', 'cell')

  if (fetchErr) {
    console.error('Failed to fetch meeting IDs:', fetchErr.message)
    process.exit(1)
  }

  const meetingIdMap = new Map<string, string>()
  for (const m of (dbMeetings ?? [])) {
    const dayKey = (m.date as string).substring(0, 10)
    meetingIdMap.set(`${dayKey}||${m.title}`, m.id as string)
  }
  console.log(`Fetched ${meetingIdMap.size} meeting IDs from DB\n`)

  let missingMeetings = 0
  for (const info of allMeetings) {
    if (!meetingIdMap.has(`${info.dayKey}||${info.title}`)) missingMeetings++
  }
  if (missingMeetings > 0)
    console.warn(`  WARNING: ${missingMeetings} meetings not found in DB — those attendances will be skipped.`)

  // ── Step 4: Upsert people + attendance ────────────────────────────────────
  let importedPeople = 0, importedAtt = 0, skippedPeople = 0, skippedAtt = 0

  for (const person of data) {
    const breezeId = Number(person['Breeze ID'])
    const { first, last, full } = buildName(
      String(person['First Name'] ?? ''),
      String(person['Last Name']  ?? '')
    )

    const { data: p, error: pErr } = await supabase
      .from('people')
      .upsert(
        {
          breeze_id:  breezeId,
          first_name: first,
          last_name:  last,
          name:       full,
          email:      `${breezeId}@breeze.import`,
        },
        { onConflict: 'breeze_id' }
      )
      .select('id')
      .single()

    if (pErr || !p) {
      console.warn(`  SKIP person ${full} (${breezeId}): ${pErr?.message}`)
      skippedPeople++
      continue
    }
    importedPeople++

    const attRows: { meeting_id: string; person_id: string; present: boolean }[] = []
    for (const [key, val] of Object.entries(person)) {
      if (SKIP.has(key) || val !== 'X') continue
      const info = parseKey(key)
      if (!info) continue
      const meetingId = meetingIdMap.get(`${info.dayKey}||${info.title}`)
      if (meetingId) attRows.push({ meeting_id: meetingId, person_id: p.id, present: true })
      else skippedAtt++
    }

    if (attRows.length > 0) {
      const { error: attErr } = await supabase
        .from('attendance')
        .upsert(attRows, { onConflict: 'meeting_id,person_id' })
      if (attErr) {
        console.warn(`  WARN attendance for ${full}: ${attErr.message}`)
      } else {
        importedAtt += attRows.length
        console.log(`  ${full.padEnd(30)} ${attRows.length} cell attendances`)
      }
    } else {
      console.log(`  ${full.padEnd(30)} no cell attendance recorded`)
    }
  }

  console.log('\n─────────────────────────────────────────')
  console.log(`People:     ${importedPeople} imported, ${skippedPeople} skipped`)
  console.log(`Cell attendance: ${importedAtt} records inserted`)
  if (skippedAtt > 0) console.log(`Skipped: ${skippedAtt} (meeting ID not found)`)
  console.log('─────────────────────────────────────────')

  // ── Step 5: Verify ────────────────────────────────────────────────────────
  console.log('\nVerifying DB counts...')
  const [
    { count: meetingCount },
    { count: attCount },
    { count: peopleCount },
  ] = await Promise.all([
    supabase.from('meetings').select('*', { count: 'exact', head: true }),
    supabase.from('attendance').select('*', { count: 'exact', head: true }),
    supabase.from('people').select('*', { count: 'exact', head: true }),
  ])
  console.log(`  meetings:   ${meetingCount}`)
  console.log(`  attendance: ${attCount}`)
  console.log(`  people:     ${peopleCount}`)

  // Cell-specific counts
  const { count: cellMeetingCount } = await supabase
    .from('meetings')
    .select('*', { count: 'exact', head: true })
    .eq('service_type', 'cell')
  console.log(`  cell meetings: ${cellMeetingCount}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })

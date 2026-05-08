/**
 * Import attendance from a Breeze-exported Excel or CSV file into Supabase.
 *
 * Run: npx tsx scripts/import-excel-attendance.ts <file> <group-name>
 *
 * Examples:
 *   npx tsx scripts/import-excel-attendance.ts data/cc.xlsx CharmCity
 *   npx tsx scripts/import-excel-attendance.ts data/mega.csv MEGA
 *
 * File format expected (Breeze export):
 *   Col 0: Breeze ID  |  Col 1: First Name  |  Col 2: Last Name
 *   Col 3+: "Month D, YYYY (Event Name)"  —  'X' or non-zero number = attended
 *   Last col: "Person Totals" (skipped)
 */

import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'

// ── Env ──────────────────────────────────────────────────────
const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

function createSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const supabase = createSupabase()

// ── Helpers ──────────────────────────────────────────────────
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Classify meeting type from event name
function meetingType(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('sunday') || n.includes('sunday service')) return 'Sunday'
  if (n.includes('wednesday') || n.includes('midweek') || n.includes('wed service')) return 'Wednesday'
  if (n.includes('cell') || n.includes('bible study') || n.includes('fusion') ||
      n.includes('ablaze') || n.includes('agape') || n.includes('visionar') ||
      n.includes('oasis @') || n.includes('oasis@')) return 'Cell'
  if (n.includes('prayer')) return 'Prayer'
  if (n.includes('outreach')) return 'Outreach'
  if (n.includes('hub') || n.includes('professional') || n.includes('leaders')) return 'Leadership'
  if (n.includes('ethereal') || n.includes('fire hour') || n.includes('hom ')) return 'Special'
  return 'Other'
}

// Parse "Apr 6, 2025 (Event Name)" → { date, name }
function parseHeader(h: string): { date: string; name: string } | null {
  const m = h.match(/^(.+?)\s+\((.+)\)$/)
  if (!m) return null
  const d = new Date(m[1].trim())
  if (isNaN(d.getTime())) return null
  return {
    date: d.toISOString().split('T')[0],
    name: m[2].trim(),
  }
}

// Attended = 'X' (xlsx) or any non-zero number (csv)
function isAttended(cell: unknown, isCsv: boolean): boolean {
  if (cell === null || cell === undefined) return false
  const v = String(cell).trim()
  if (!v || v === '0') return false
  if (isCsv) return true
  return v.toUpperCase() === 'X'
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const filePath  = process.argv[2]
  const groupName = process.argv[3]

  if (!filePath || !groupName) {
    console.error('Usage: npx tsx scripts/import-excel-attendance.ts <file> <group-name>')
    process.exit(1)
  }

  const isCsv = filePath.toLowerCase().endsWith('.csv')
  console.log(`\n=== Attendance Import ===`)
  console.log(`File:  ${filePath}`)
  console.log(`Group: ${groupName}`)
  const t0 = Date.now()

  // Log sync start
  const { data: syncRow } = await supabase
    .from('sync_log')
    .insert({ source: path.basename(filePath), group_name: groupName, status: 'running' })
    .select('id').single()
  const syncId = syncRow?.id as string | null

  // 1. Parse file
  const wb   = XLSX.readFile(filePath, { raw: false })
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })

  const headers  = rows[0] as (string | null)[]
  const dataRows = rows.slice(1).filter(r => {
    const id = (r as unknown[])[0]
    return id !== null && id !== undefined && String(id).trim() !== ''
  }) as unknown[][]

  console.log(`  People rows: ${dataRows.length}`)

  // 2. Parse event columns
  const eventCols: { idx: number; date: string; name: string; type: string }[] = []
  for (let i = 3; i < headers.length; i++) {
    const h = headers[i]
    if (!h || h === 'Person Totals') continue
    const parsed = parseHeader(h)
    if (!parsed) continue
    eventCols.push({ idx: i, date: parsed.date, name: parsed.name, type: meetingType(parsed.name) })
  }
  console.log(`  Event columns: ${eventCols.length}`)

  // 3. Upsert group
  const { data: groupRow } = await supabase
    .from('groups')
    .upsert({ name: groupName }, { onConflict: 'name' })
    .select('id').single()
  const groupId = groupRow!.id as string
  console.log(`  Group ID: ${groupId}`)

  // 4. Upsert meetings (deduplicated by group + date + name)
  const uniqueMeetings = new Map<string, typeof eventCols[0]>()
  for (const e of eventCols) {
    const key = `${e.date}::${e.name}`
    if (!uniqueMeetings.has(key)) uniqueMeetings.set(key, e)
  }

  const meetingRows = [...uniqueMeetings.values()].map(e => ({
    group_id:     groupId,
    meeting_date: e.date,
    meeting_type: e.type,
    name:         e.name,
  }))

  for (const batch of chunk(meetingRows, 100)) {
    const { error } = await supabase
      .from('meetings')
      .upsert(batch, { onConflict: 'group_id,meeting_date,name' })
    if (error) console.error('  Meeting upsert error:', error.message)
  }
  console.log(`  Meetings upserted: ${meetingRows.length}`)

  // Load meeting key → UUID
  const meetingKeyToId = new Map<string, string>()
  for (const batch of chunk([...uniqueMeetings.keys()].map(k => {
    const [date, ...rest] = k.split('::')
    return { date, name: rest.join('::') }
  }), 80)) {
    const { data } = await supabase
      .from('meetings')
      .select('id, meeting_date, name')
      .eq('group_id', groupId)
      .in('meeting_date', batch.map(b => b.date))
    for (const row of data ?? []) {
      meetingKeyToId.set(`${row.meeting_date}::${row.name}`, row.id)
    }
  }

  // 5. Upsert attendees (by breeze_id when available, else by name)
  const attendeeRows = dataRows.map(r => {
    const breezeId = r[0] != null ? Number(r[0]) : null
    const fullName = `${String(r[1] ?? '').trim()} ${String(r[2] ?? '').trim()}`.trim()
    return { breeze_id: breezeId, name: fullName || 'Unknown' }
  }).filter(a => a.name !== 'Unknown')

  // Upsert by breeze_id (conflict = breeze_id unique index)
  const withId    = attendeeRows.filter(a => a.breeze_id)
  const withoutId = attendeeRows.filter(a => !a.breeze_id)

  for (const batch of chunk(withId, 200)) {
    const { error } = await supabase
      .from('attendees')
      .upsert(batch, { onConflict: 'breeze_id' })
    if (error) console.error('  Attendee upsert error:', error.message)
  }

  // For rows without a Breeze ID: insert only if name doesn't exist
  for (const a of withoutId) {
    const { data: existing } = await supabase
      .from('attendees').select('id').eq('name', a.name).maybeSingle()
    if (!existing) {
      await supabase.from('attendees').insert({ name: a.name })
    }
  }

  console.log(`  Attendees upserted: ${attendeeRows.length}`)

  // Build breeze_id / name → UUID lookup
  const breezeToUuid = new Map<string, string>()
  const nameToUuid   = new Map<string, string>()
  let offset = 0
  while (true) {
    const { data } = await supabase.from('attendees').select('id, name, breeze_id').range(offset, offset + 999)
    if (!data?.length) break
    for (const r of data) {
      if (r.breeze_id) breezeToUuid.set(String(r.breeze_id), r.id)
      nameToUuid.set(r.name, r.id)
    }
    if (data.length < 1000) break
    offset += 1000
  }

  // 6. Build attendance records
  console.log('Building attendance records...')
  const attRows: { meeting_id: string; attendee_id: string; status: string }[] = []
  let skipped = 0

  for (const row of dataRows) {
    const breezeId   = row[0] != null ? String(row[0]).trim() : ''
    const fullName   = `${String(row[1] ?? '').trim()} ${String(row[2] ?? '').trim()}`.trim()
    const attendeeId = breezeToUuid.get(breezeId) ?? nameToUuid.get(fullName)
    if (!attendeeId) { skipped++; continue }

    for (const ecol of eventCols) {
      if (!isAttended(row[ecol.idx], isCsv)) continue
      const meetingId = meetingKeyToId.get(`${ecol.date}::${ecol.name}`)
      if (!meetingId) continue
      attRows.push({ meeting_id: meetingId, attendee_id: attendeeId, status: 'present' })
    }
  }

  console.log(`  Records to insert: ${attRows.length}  (skipped: ${skipped})`)

  let inserted = 0
  for (const batch of chunk(attRows, 200)) {
    const { error } = await supabase
      .from('attendance')
      .upsert(batch, { onConflict: 'meeting_id,attendee_id', ignoreDuplicates: true })
    if (error) console.error('  Attendance error:', error.message)
    else inserted += batch.length
  }

  // 7. Wrap up
  const duration = ((Date.now() - t0) / 1000).toFixed(1)
  if (syncId) {
    await supabase.from('sync_log').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      meetings_created: meetingRows.length,
      attendees_created: attendeeRows.length,
      attendance_created: inserted,
    }).eq('id', syncId)
  }

  const { count: totalMeetings }    = await supabase.from('meetings').select('*', { count: 'exact', head: true })
  const { count: totalAttendees }   = await supabase.from('attendees').select('*', { count: 'exact', head: true })
  const { count: totalAttendance }  = await supabase.from('attendance').select('*', { count: 'exact', head: true })

  console.log(`\n─────────────────────────────────────────────`)
  console.log(`Done in ${duration}s`)
  console.log(`  Meetings upserted:   ${meetingRows.length}`)
  console.log(`  Attendees upserted:  ${attendeeRows.length}`)
  console.log(`  Attendance inserted: ${inserted}`)
  console.log(`  Total meetings:      ${totalMeetings}`)
  console.log(`  Total attendees:     ${totalAttendees}`)
  console.log(`  Total attendance:    ${totalAttendance}`)
  console.log(`─────────────────────────────────────────────\n`)
}

main().catch(err => {
  console.error('Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})

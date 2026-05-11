/**
 * Sync attendance from all Breeze calendar feeds into Supabase.
 *
 * Run: npx tsx scripts/sync-from-calendar.ts [from] [to]
 * Example: npx tsx scripts/sync-from-calendar.ts 2026-04-25 2026-05-09
 *
 * Defaults: last 3 weeks → today
 *
 * To sync a single feed with a group override:
 *   npx tsx scripts/sync-from-calendar.ts <url> <group> [from] [to]
 */

import * as path from 'path'
import * as fs from 'fs'
import { syncAllFeeds, syncCalendarFeed, createSupabaseAdmin, CALENDAR_FEEDS } from '../lib/sync-calendars'

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/)
    if (m) process.env[m[1]] = m[2].trim()
  }
}

async function main() {
  const today = new Date().toISOString().split('T')[0]
  const threeWeeksAgo = (() => {
    const d = new Date(); d.setDate(d.getDate() - 21); return d.toISOString().split('T')[0]
  })()

  // Single-feed mode: npx tsx sync-from-calendar.ts <url> <group> [from] [to]
  const firstArg = process.argv[2]
  if (firstArg?.startsWith('http')) {
    const groupName = process.argv[3] ?? 'MEGA'
    const from = process.argv[4] ?? threeWeeksAgo
    const to   = process.argv[5] ?? today
    console.log(`=== Syncing ${groupName} (${from} → ${to}) ===\n`)
    const supabase = createSupabaseAdmin()
    const { data: groupRows } = await supabase.from('groups').select('id, name')
    const groupId = (groupRows ?? []).find((g: { id: string; name: string }) => g.name === groupName)?.id ?? null
    const breezeToUuid = new Map<number, string>()
    let offset = 0
    while (true) {
      const { data: rows } = await supabase.from('attendees').select('id, breeze_id').not('breeze_id', 'is', null).range(offset, offset + 999)
      if (!rows || rows.length === 0) break
      for (const r of rows) breezeToUuid.set(Number(r.breeze_id), r.id)
      if (rows.length < 1000) break
      offset += 1000
    }
    const r = await syncCalendarFeed(supabase, firstArg, groupName, groupId, from, to, breezeToUuid, console.log)
    console.log(`\nDone: ${r.meetingsCreated} meetings created, ${r.attendanceAdded} attendance added, ${r.errors} errors`)
    if (r.errorDetails.length) console.log('Errors:', r.errorDetails)
    return
  }

  // All-feeds mode
  const from = process.argv[2] ?? threeWeeksAgo
  const to   = process.argv[3] ?? today
  console.log(`=== Syncing all ${CALENDAR_FEEDS.length} feeds (${from} → ${to}) ===\n`)

  const results = await syncAllFeeds(from, to, msg => process.stdout.write(msg + '\n'))

  console.log('\n─────────────────────────────────────────────')
  let totalMeetings = 0, totalAtt = 0
  for (const r of results) {
    console.log(`  ${r.group.padEnd(15)} meetings: ${String(r.meetingsCreated).padStart(3)}  attendance: ${String(r.attendanceAdded).padStart(4)}  errors: ${r.errors}`)
    totalMeetings += r.meetingsCreated
    totalAtt += r.attendanceAdded
  }
  console.log('─────────────────────────────────────────────')
  console.log(`  TOTAL              meetings: ${String(totalMeetings).padStart(3)}  attendance: ${String(totalAtt).padStart(4)}`)
  console.log('─────────────────────────────────────────────')
}

main().catch(err => {
  console.error('Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})

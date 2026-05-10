/**
 * Pull phone numbers from Breeze and write them into attendees.phone.
 *
 * Run: npx tsx scripts/sync-attendee-phones.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'
import { fetchAllPeople } from '../lib/breeze'

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = path.join(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  console.log('=== Syncing phone numbers from Breeze → attendees ===\n')

  // 1. Fetch all people from Breeze
  console.log('Fetching people from Breeze...')
  const people = await fetchAllPeople(n => process.stdout.write(`\r  Fetched ${n}...`))
  console.log(`\n  Total from Breeze: ${people.length}`)

  // 2. Build breeze_id → phone map (only entries that have a phone)
  const phoneMap = new Map<number, string>()
  for (const p of people) {
    if (p.phone?.trim()) phoneMap.set(Number(p.breeze_id), p.phone.trim())
  }
  console.log(`  People with phone numbers in Breeze: ${phoneMap.size}`)

  // 3. Load all attendees that have a breeze_id (paginate past 1000 row limit)
  console.log('\nLoading attendees from Supabase...')
  const attendees: { id: string; breeze_id: number; phone: string | null }[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('attendees')
      .select('id, breeze_id, phone')
      .not('breeze_id', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error('Failed to load attendees: ' + error.message)
    if (!data || data.length === 0) break
    attendees.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`  Attendees with breeze_id: ${attendees.length}`)

  // 4. Build update rows
  const updates: { id: string; phone: string }[] = []
  for (const a of attendees ?? []) {
    const phone = phoneMap.get(Number(a.breeze_id))
    if (phone && phone !== a.phone) {
      updates.push({ id: a.id, phone })
    }
  }
  console.log(`  Attendees to update: ${updates.length}`)

  if (updates.length === 0) {
    console.log('\nNothing to update.')
    return
  }

  // 5. Apply updates in batches
  console.log('\nApplying updates...')
  let updated = 0
  let errors = 0

  for (const batch of chunk(updates, 200)) {
    for (const row of batch) {
      const { error: uErr } = await supabase
        .from('attendees')
        .update({ phone: row.phone })
        .eq('id', row.id)
      if (uErr) { errors++; console.error(`  Error on ${row.id}:`, uErr.message) }
      else updated++
    }
    process.stdout.write(`\r  Updated ${updated}/${updates.length}...`)
  }

  console.log(`\n\n─────────────────────────────────────────`)
  console.log(`Done.`)
  console.log(`  Phone numbers written: ${updated}`)
  console.log(`  Errors:                ${errors}`)
  console.log(`─────────────────────────────────────────`)
}

main().catch(err => {
  console.error('Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})

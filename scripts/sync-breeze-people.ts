/**
 * Sync all Breeze people into the attendees table.
 *
 * Run: npx tsx scripts/sync-breeze-people.ts
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
  console.log('=== Breeze → Supabase People Sync ===\n')

  // 1. Fetch all people from Breeze
  console.log('Fetching people from Breeze...')
  const people = await fetchAllPeople(n => process.stdout.write(`\r  Fetched ${n}...`))
  console.log(`\n  Total: ${people.length} people`)

  // 2. Upsert into attendees
  console.log('\nUpserting into attendees...')
  let upserted = 0
  let errors = 0

  for (const batch of chunk(people, 200)) {
    const rows = batch.map(p => ({
      breeze_id: Number(p.breeze_id),
      name: [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.first_name,
      phone: p.phone ?? null,
    }))

    const { error } = await supabase
      .from('attendees')
      .upsert(rows, { onConflict: 'breeze_id', ignoreDuplicates: false })

    if (error) {
      console.error(`  Batch error: ${error.message}`)
      errors++
    } else {
      upserted += rows.length
    }
    process.stdout.write(`\r  Processed ${upserted}/${people.length}...`)
  }

  // 3. Summary
  const { count } = await supabase
    .from('attendees')
    .select('*', { count: 'exact', head: true })

  console.log(`\n\n─────────────────────────────────────────────`)
  console.log(`Done.`)
  console.log(`  Breeze people processed: ${people.length}`)
  console.log(`  Batch errors:            ${errors}`)
  console.log(`  Total attendees in DB:   ${count}`)
  console.log(`─────────────────────────────────────────────`)
}

main().catch(err => {
  console.error('Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})

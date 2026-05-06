/**
 * Sync all Breeze people into Supabase people table.
 *
 * Setup:
 *   1. Run db/005_breeze_people_fields.sql in Supabase SQL Editor first
 *   2. Run: npx tsx scripts/sync-breeze-people.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'
import { fetchAllPeople } from '../lib/breeze'

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

async function main() {
  console.log('Fetching all people from Breeze...')
  const people = await fetchAllPeople(n => process.stdout.write(`\r  Fetched ${n}...`))
  console.log(`\nTotal: ${people.length} people from Breeze`)

  const now = new Date().toISOString()
  let upserted = 0, errors = 0

  for (const batch of chunk(people, 100)) {
    const rows = batch.map(p => ({
      breeze_id:                   Number(p.breeze_id),
      first_name:                  p.first_name,
      last_name:                   p.last_name,
      name:                        p.last_name ? `${p.first_name} ${p.last_name}`.trim() : p.first_name,
      email:                       p.email ?? `${p.breeze_id}@breeze.import`,
      phone:                       p.phone,
      address:                     p.address,
      gender:                      p.gender,
      birthdate:                   p.birthdate,
      group_name:                  p.group_name,
      pastor:                      p.pastor,
      designation:                 p.designation,
      cell_name:                   p.cell_name,
      fellowship:                  p.fellowship,
      who_invited:                 p.who_invited,
      joined_oasis:                p.joined_oasis,
      baptized:                    p.baptized,
      foundation_school:           p.foundation_school,
      foundation_school_grad_year: p.foundation_school_grad_year,
      school:                      p.school,
      major:                       p.major,
      profession:                  p.profession,
      marital_status:              p.marital_status,
      state:                       p.state,
      unique_id:                   p.unique_id,
      breeze_synced_at:            now,
    }))

    const { error } = await supabase
      .from('people')
      .upsert(rows, { onConflict: 'breeze_id' })

    if (error) {
      console.error(`  Batch error: ${error.message}`)
      errors++
    } else {
      upserted += batch.length
      process.stdout.write(`\r  Upserted ${upserted}/${people.length}...`)
    }
  }

  console.log(`\n\n─────────────────────────────────────────`)
  console.log(`Upserted: ${upserted} | Errors: ${errors} batches`)

  // ── Verify ─────────────────────────────────────────────────────────────────
  const { count } = await supabase.from('people').select('*', { count: 'exact', head: true })
  console.log(`Total people in Supabase: ${count}`)

  const { data: sample } = await supabase
    .from('people')
    .select('first_name, last_name, group_name, pastor, designation, cell_name')
    .not('group_name', 'is', null)
    .limit(5)
  console.log('\nSample enriched records:')
  sample?.forEach(p => console.log(`  ${p.first_name} ${p.last_name} | ${p.group_name} | ${p.pastor} | ${p.designation}`))
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })

/**
 * Sync all Breeze people into the people table.
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

  // 2. Fetch all people from Breeze
  console.log('\nFetching people from Breeze...')
  const people = await fetchAllPeople(n => process.stdout.write(`\r  Fetched ${n}...`))
  console.log(`\n  Total: ${people.length} people`)

  // 3. Upsert into people
  console.log('\nUpserting into people...')
  const now = new Date().toISOString()
  let upserted = 0
  let errors = 0

  for (const batch of chunk(people, 200)) {
    const rows = batch.map(p => ({
      church_id:                    churchId,
      breeze_id:                    Number(p.breeze_id),
      first_name:                   p.first_name,
      last_name:                    p.last_name,
      email:                        p.email ?? null,
      phone:                        p.phone ?? null,
      address:                      p.address ?? null,
      gender:                       p.gender ?? null,
      birthdate:                    p.birthdate ?? null,
      group_name:                   p.group_name ?? null,
      pastor:                       p.pastor ?? null,
      designation:                  p.designation ?? null,
      cell_name:                    p.cell_name ?? null,
      fellowship:                   p.fellowship ?? null,
      who_invited:                  p.who_invited ?? null,
      joined_oasis:                 p.joined_oasis ?? null,
      baptized:                     p.baptized ?? null,
      foundation_school:            p.foundation_school ?? null,
      foundation_school_grad_year:  p.foundation_school_grad_year ?? null,
      school:                       p.school ?? null,
      major:                        p.major ?? null,
      profession:                   p.profession ?? null,
      marital_status:               p.marital_status ?? null,
      state:                        p.state ?? null,
      unique_id:                    p.unique_id ?? null,
      breeze_synced_at:             now,
      updated_at:                   now,
    }))

    const { error } = await supabase
      .from('people')
      .upsert(rows, { onConflict: 'church_id,breeze_id', ignoreDuplicates: false })

    if (error) {
      console.error(`  Batch error: ${error.message}`)
      errors++
    } else {
      upserted += rows.length
    }
    process.stdout.write(`\r  Processed ${upserted}/${people.length}...`)
  }

  // 4. Summary
  const { count } = await supabase
    .from('people')
    .select('*', { count: 'exact', head: true })
    .eq('church_id', churchId)

  console.log(`\n\n─────────────────────────────────────────────`)
  console.log(`Done.`)
  console.log(`  Breeze people processed: ${people.length}`)
  console.log(`  Batch errors:            ${errors}`)
  console.log(`  Total people in DB:      ${count}`)
  console.log(`─────────────────────────────────────────────`)
}

main().catch(err => {
  console.error('Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})

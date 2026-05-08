/**
 * Sync all Breeze people into Supabase (new schema).
 *
 * Run: npx tsx scripts/sync-breeze-people.ts
 *
 * What it does:
 *   1. Fetches all people from Breeze
 *   2. Upserts groups and cells derived from people profiles
 *   3. Upserts each person with group/cell FK references
 *   4. Manages active memberships in person_group_memberships + person_cell_memberships
 *   5. Logs to sync_log
 */

import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'
import { fetchAllPeople, type BreezePerson } from '../lib/breeze'

// ── Load .env.local ──────────────────────────────────────────
const envPath = path.join(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

// ── Supabase client (service role preferred) ─────────────────
function createSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey) {
    return createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) throw new Error('No Supabase key available (set SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  console.warn('[sync-breeze-people] Using anon key — service role key not found.')
  return createClient(url, anonKey)
}

const supabase = createSupabase()

// ── Utility ───────────────────────────────────────────────────
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('=== Breeze → Supabase People Sync ===')
  const syncStart = new Date()

  // 1. Insert sync_log record
  const { data: syncRow, error: syncInsertErr } = await supabase
    .from('sync_log')
    .insert({ sync_type: 'people', status: 'running' })
    .select('id')
    .single()
  if (syncInsertErr) {
    console.error('Failed to create sync_log record:', syncInsertErr.message)
    // Continue anyway — sync_log failure shouldn't abort the sync
  }
  const syncLogId: string | null = syncRow?.id ?? null

  // 2. Fetch all people from Breeze
  console.log('\nFetching people from Breeze...')
  let people: BreezePerson[]
  try {
    people = await fetchAllPeople(n => process.stdout.write(`\r  Fetched ${n}...`))
    console.log(`\n  Total: ${people.length} people`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Fatal: failed to fetch Breeze people:', msg)
    if (syncLogId) {
      await supabase.from('sync_log').update({
        status: 'error',
        completed_at: new Date().toISOString(),
        error_message: msg,
      }).eq('id', syncLogId)
    }
    process.exit(1)
  }

  // 3. Build group upserts from people data
  console.log('\nUpserting groups...')
  const uniqueGroupNames = new Set<string>()
  for (const p of people) {
    if (p.group_name?.trim()) uniqueGroupNames.add(p.group_name.trim())
  }
  if (uniqueGroupNames.size > 0) {
    const groupRows = [...uniqueGroupNames].map(name => ({
      name,
      type: 'fellowship',
    }))
    const { error: gErr } = await supabase
      .from('groups')
      .upsert(groupRows, { onConflict: 'name', ignoreDuplicates: true })
    if (gErr) console.error('  Groups upsert error:', gErr.message)
    else console.log(`  Upserted ${groupRows.length} groups`)
  }

  // Load group name → id map
  const { data: groupData, error: gLoadErr } = await supabase
    .from('groups')
    .select('id, name')
  if (gLoadErr) throw new Error('Failed to load groups: ' + gLoadErr.message)
  const groupNameToId = new Map<string, string>()
  for (const g of (groupData ?? [])) groupNameToId.set(g.name, g.id)

  // 4. Build cell upserts — unique (cell_name, group_id) pairs
  console.log('\nUpserting cells...')
  type CellKey = { cell_name: string; group_name: string }
  const uniqueCells = new Map<string, CellKey>()
  for (const p of people) {
    if (!p.cell_name?.trim()) continue
    const cellName = p.cell_name.trim()
    const groupName = p.group_name?.trim() ?? ''
    const key = `${cellName}::${groupName}`
    if (!uniqueCells.has(key)) uniqueCells.set(key, { cell_name: cellName, group_name: groupName })
  }

  if (uniqueCells.size > 0) {
    const cellRows = [...uniqueCells.values()].map(({ cell_name, group_name }) => ({
      name: cell_name,
      group_id: groupNameToId.get(group_name) ?? null,
      status: 'active',
    }))
    // Upsert cells in small batches to avoid conflicts
    for (const batch of chunk(cellRows, 100)) {
      const { error: cErr } = await supabase
        .from('cells')
        .upsert(batch, { onConflict: 'name,group_id', ignoreDuplicates: true })
      if (cErr) console.error('  Cells upsert error:', cErr.message)
    }
    console.log(`  Upserted ${cellRows.length} cells`)
  }

  // Load cell (name, group_id) → id map
  const { data: cellData, error: cLoadErr } = await supabase
    .from('cells')
    .select('id, name, group_id')
  if (cLoadErr) throw new Error('Failed to load cells: ' + cLoadErr.message)
  // Key: "cellName::groupId" (group_id may be null → use "")
  const cellKeyToId = new Map<string, string>()
  for (const c of (cellData ?? [])) {
    const key = `${c.name}::${c.group_id ?? ''}`
    cellKeyToId.set(key, c.id)
  }

  // 5. Upsert people
  console.log('\nUpserting people...')
  let totalCreated = 0
  let totalUpdated = 0
  let totalErrors = 0
  // Track person breeze_id → supabase uuid for membership step
  const breezeIdToUuid = new Map<string, string>()

  for (const batch of chunk(people, 100)) {
    const rows = batch.map(p => {
      const groupId  = p.group_name?.trim() ? (groupNameToId.get(p.group_name.trim()) ?? null) : null
      const groupKey = `${p.cell_name?.trim() ?? ''}::${groupId ?? ''}`
      const cellId   = p.cell_name?.trim() ? (cellKeyToId.get(groupKey) ?? null) : null

      return {
        breeze_id:                   Number(p.breeze_id),
        first_name:                  p.first_name || '',
        last_name:                   p.last_name  || '',
        email:                       p.email      ?? null,
        phone:                       p.phone      ?? null,
        address:                     p.address    ?? null,
        gender:                      p.gender     ?? null,
        birthdate:                   p.birthdate  ?? null,
        designation:                 p.designation ?? null,
        joined_oasis:                p.joined_oasis ?? null,
        baptized:                    p.baptized   ?? null,
        foundation_school:           p.foundation_school ?? null,
        foundation_school_grad_year: p.foundation_school_grad_year ?? null,
        school:                      p.school     ?? null,
        major:                       p.major      ?? null,
        profession:                  p.profession ?? null,
        marital_status:              p.marital_status ?? null,
        state:                       p.state      ?? null,
        who_invited:                 p.who_invited ?? null,
        unique_id:                   p.unique_id  ?? null,
        current_group_id:            groupId,
        current_cell_id:             cellId,
        current_pastor:              p.pastor     ?? null,
        updated_at:                  new Date().toISOString(),
      }
    })

    const { data: upserted, error: pErr } = await supabase
      .from('people')
      .upsert(rows, { onConflict: 'breeze_id' })
      .select('id, breeze_id')

    if (pErr) {
      console.error(`  People batch error: ${pErr.message}`)
      totalErrors++
      continue
    }

    for (const row of (upserted ?? [])) {
      breezeIdToUuid.set(String(row.breeze_id), row.id)
    }
    totalCreated += upserted?.length ?? 0

    process.stdout.write(`\r  Processed ${breezeIdToUuid.size}/${people.length}...`)
  }
  console.log(`\n  Done. People upserted: ${breezeIdToUuid.size} | Batch errors: ${totalErrors}`)

  // If breezeIdToUuid is sparse (upsert didn't return all), load from DB
  if (breezeIdToUuid.size < people.length * 0.5) {
    console.log('  Loading people map from DB (upsert returned sparse results)...')
    const { data: allPeople } = await supabase
      .from('people')
      .select('id, breeze_id')
      .limit(20000)
    for (const row of (allPeople ?? [])) {
      breezeIdToUuid.set(String(row.breeze_id), row.id)
    }
  }

  // 6. Upsert memberships
  console.log('\nSyncing group/cell memberships...')
  let membershipChanges = 0

  for (const batch of chunk(people, 50)) {
    for (const p of batch) {
      const personUuid = breezeIdToUuid.get(p.breeze_id)
      if (!personUuid) continue

      const groupId = p.group_name?.trim() ? (groupNameToId.get(p.group_name.trim()) ?? null) : null
      const groupKey = `${p.cell_name?.trim() ?? ''}::${groupId ?? ''}`
      const cellId = p.cell_name?.trim() ? (cellKeyToId.get(groupKey) ?? null) : null

      // ── Group membership ──────────────────────────────────
      if (groupId) {
        // Check for existing active membership
        const { data: existingGrpMembership } = await supabase
          .from('person_group_memberships')
          .select('id, group_id')
          .eq('person_id', personUuid)
          .eq('active', true)
          .maybeSingle()

        if (!existingGrpMembership) {
          // No active membership — insert new
          await supabase.from('person_group_memberships').insert({
            person_id: personUuid,
            group_id: groupId,
            joined_at: new Date().toISOString(),
            active: true,
          })
          membershipChanges++
        } else if (existingGrpMembership.group_id !== groupId) {
          // Different group — deactivate old, insert new
          await supabase
            .from('person_group_memberships')
            .update({ active: false, left_at: new Date().toISOString() })
            .eq('id', existingGrpMembership.id)

          await supabase.from('person_group_memberships').insert({
            person_id: personUuid,
            group_id: groupId,
            joined_at: new Date().toISOString(),
            active: true,
          })

          // Log the group change
          await supabase.from('relationship_history').insert({
            person_id: personUuid,
            relationship_type: 'group_change',
            old_value: existingGrpMembership.group_id,
            new_value: groupId,
            source: 'breeze_sync',
          })
          membershipChanges++
        }
        // else: same group, nothing to do
      }

      // ── Cell membership ───────────────────────────────────
      if (cellId) {
        const { data: existingCellMembership } = await supabase
          .from('person_cell_memberships')
          .select('id, cell_id')
          .eq('person_id', personUuid)
          .eq('active', true)
          .maybeSingle()

        if (!existingCellMembership) {
          await supabase.from('person_cell_memberships').insert({
            person_id: personUuid,
            cell_id: cellId,
            joined_at: new Date().toISOString(),
            active: true,
          })
          membershipChanges++
        } else if (existingCellMembership.cell_id !== cellId) {
          await supabase
            .from('person_cell_memberships')
            .update({ active: false, left_at: new Date().toISOString() })
            .eq('id', existingCellMembership.id)

          await supabase.from('person_cell_memberships').insert({
            person_id: personUuid,
            cell_id: cellId,
            joined_at: new Date().toISOString(),
            active: true,
          })

          await supabase.from('relationship_history').insert({
            person_id: personUuid,
            relationship_type: 'cell_change',
            old_value: existingCellMembership.cell_id,
            new_value: cellId,
            source: 'breeze_sync',
          })
          membershipChanges++
        }
      }
    }
  }
  console.log(`  Membership changes: ${membershipChanges}`)

  // 7. Leadership: find people with a pastor role via their designation
  // We record leaders by looking for people whose designation indicates a leadership role.
  // Additionally, for every unique pastor name in the data, ensure there's a person record
  // and mark them in the leaders table if they exist.
  console.log('\nSyncing leaders...')
  const uniquePastorNames = new Set<string>()
  for (const p of people) {
    if (p.pastor?.trim()) uniquePastorNames.add(p.pastor.trim())
  }

  let leadersSynced = 0
  for (const pastorName of uniquePastorNames) {
    // Find a person record that matches this pastor name
    const nameParts = pastorName.replace(/^(Pastor|Ps\.?|Rev\.?)\s*/i, '').trim().split(/\s+/)
    const firstName = nameParts[0] ?? ''
    const lastName  = nameParts.slice(1).join(' ') || ''

    if (!firstName) continue

    let query = supabase
      .from('people')
      .select('id')
      .ilike('first_name', `%${firstName}%`)

    if (lastName) query = query.ilike('last_name', `%${lastName}%`)

    const { data: pastorPeople } = await query.limit(1)

    if (!pastorPeople || pastorPeople.length === 0) continue

    const personId = pastorPeople[0].id

    // Check if leader record exists
    const { data: existingLeader } = await supabase
      .from('leaders')
      .select('id')
      .eq('person_id', personId)
      .eq('active', true)
      .maybeSingle()

    if (!existingLeader) {
      await supabase.from('leaders').insert({
        person_id: personId,
        role: 'pastor',
        assigned_at: new Date().toISOString(),
        active: true,
      })
      leadersSynced++
    }
  }
  console.log(`  Leaders synced: ${leadersSynced}`)

  // 8. Update sync_log
  const completed = new Date()
  const duration  = ((completed.getTime() - syncStart.getTime()) / 1000).toFixed(1)
  if (syncLogId) {
    await supabase.from('sync_log').update({
      status: 'completed',
      completed_at: completed.toISOString(),
      records_processed: people.length,
      records_created: totalCreated,
      records_updated: totalUpdated,
    }).eq('id', syncLogId)
  }

  // 9. Summary
  const { count: peopleCount } = await supabase
    .from('people')
    .select('*', { count: 'exact', head: true })
  const { count: groupCount } = await supabase
    .from('groups')
    .select('*', { count: 'exact', head: true })
  const { count: cellCount } = await supabase
    .from('cells')
    .select('*', { count: 'exact', head: true })

  console.log('\n─────────────────────────────────────────────')
  console.log(`Sync completed in ${duration}s`)
  console.log(`  People in Supabase:  ${peopleCount}`)
  console.log(`  Groups in Supabase:  ${groupCount}`)
  console.log(`  Cells in Supabase:   ${cellCount}`)
  console.log(`  Membership changes:  ${membershipChanges}`)
  console.log(`  Leaders synced:      ${leadersSynced}`)
  console.log(`  Batch errors:        ${totalErrors}`)
  console.log('─────────────────────────────────────────────')
}

main().catch(err => {
  console.error('Fatal error:', err instanceof Error ? err.message : err)
  process.exit(1)
})

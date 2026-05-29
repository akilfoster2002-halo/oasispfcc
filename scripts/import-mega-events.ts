#!/usr/bin/env npx tsx
/**
 * One-shot import: fetch every event from Breeze and upsert into the `events`
 * table under the MEGA group. Run with:
 *   npx tsx scripts/import-mega-events.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const CHURCH_ID = 'fd2c3d24-ec10-4c9c-bbd1-bef58903d121'
const MEGA_GROUP_ID = '1b6a8965-1c95-404c-84e4-fd912bcd7c00'

const BREEZE_KEY = process.env.BREEZE_API_KEY!
const BREEZE_SUB = process.env.BREEZE_SUBDOMAIN!
const BREEZE_BASE = `https://${BREEZE_SUB}.breezechms.com/api`
const HEADERS = { 'Api-Key': BREEZE_KEY, 'Content-Type': 'application/json' }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

function classifyServiceType(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('sunday') && (n.includes('online') || n.includes('stream'))) return 'sunday_online'
  if (n.includes('sunday')) return 'sunday_inperson'
  if (n.includes('wednesday') || n.includes('midweek') || n.includes('wed')) return 'midweek'
  if (n.includes('cell') || n.includes('small group')) return 'cell'
  return 'other'
}

async function fetchBreezeEvents() {
  const url = `${BREEZE_BASE}/events?start=2020-01-01&end=2026-12-31&limit=500`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`Breeze events failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<Array<{
    id: string; event_id: string; name: string;
    start_datetime: string; end_datetime: string; category_id: string
  }>>
}

async function importEvents() {
  console.log('Fetching events from Breeze…')
  const events = await fetchBreezeEvents()
  console.log(`Found ${events.length} events`)

  const rows = events.map(e => {
    const dateStr = e.start_datetime?.split(' ')[0] ?? '1970-01-01'
    const datetimeStr = e.start_datetime?.replace(' ', 'T') + 'Z'
    return {
      church_id: CHURCH_ID,
      breeze_instance_id: e.id,
      breeze_event_id: e.event_id,
      name: e.name,
      service_type: classifyServiceType(e.name),
      event_date: dateStr,
      event_datetime: datetimeStr,
      group_id: MEGA_GROUP_ID,
    }
  })

  // Upsert in batches of 50
  let inserted = 0
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const { error } = await supabase
      .from('events')
      .upsert(batch, { onConflict: 'breeze_instance_id' })
    if (error) {
      console.error('Event upsert error:', error.message)
    } else {
      inserted += batch.length
      process.stdout.write(`\r  Upserted ${inserted}/${rows.length} events…`)
    }
  }
  console.log(`\nDone — ${inserted} events imported.`)
}

async function importPeople() {
  console.log('\nFetching people from Breeze…')
  const all: unknown[] = []
  const limit = 500
  let offset = 0

  while (true) {
    const url = `${BREEZE_BASE}/people?limit=${limit}&offset=${offset}&details=1`
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) throw new Error(`Breeze people failed: ${res.status}`)
    const page = await res.json() as Array<Record<string, unknown>>
    if (!Array.isArray(page) || page.length === 0) break
    all.push(...page)
    process.stdout.write(`\r  Fetched ${all.length} people…`)
    offset += page.length
    if (page.length < limit) break
  }
  console.log(`\nFetched ${all.length} people total`)

  // Parse and upsert
  const FIELD: Record<string, string> = {
    phone: '715376523', email: '1561956113', address: '1173366758',
    gender: '1151514576', birthdate: '1124604630', group: '1269653662',
    pastor: '918037587', designation: '2054355940', cell: '2054356051',
    fellowship: '2054355941', whoInvited: '2054356620', joinedOasis: '2054355938',
    baptized: '2054355939', foundationSchool: '2054356050', foundationSchoolGradYear: '2054356052',
    school: '2054355942', major: '1464172649', profession: '2054355936',
    maritalStatus: '1593421212', state: '2054355937', uniqueId: '2054355944',
  }

  function extract(d: Record<string, unknown>, fieldId: string): string | null {
    const val = d?.[fieldId]
    if (val === null || val === undefined || val === '') return null
    if (typeof val === 'string') return val.trim() || null
    if (typeof val === 'object' && !Array.isArray(val) && 'name' in (val as object))
      return ((val as Record<string, string>).name) || null
    if (Array.isArray(val)) {
      for (const item of val) {
        if ((item as Record<string, string>)?.phone_number?.trim()) return (item as Record<string, string>).phone_number.trim()
        if ((item as Record<string, string>)?.address?.trim()) return (item as Record<string, string>).address.trim()
      }
    }
    return null
  }

  function extractAddress(d: Record<string, unknown>): string | null {
    const val = d?.[FIELD.address]
    if (!val) return null
    const items = Array.isArray(val) ? val : [val]
    for (const item of items) {
      const r = item as Record<string, string>
      const parts = [r.street_address, r.city, r.state, r.zip].filter(Boolean)
      if (parts.length > 0) return parts.join(', ')
    }
    return null
  }

  const rows = (all as Array<{
    id: string; first_name: string; last_name: string;
    details?: Record<string, unknown>
  }>).map(raw => {
    const d = raw.details ?? {}
    const bd = extract(d, FIELD.birthdate) ?? (d.birthdate as string | null) ?? null
    return {
      church_id: CHURCH_ID,
      breeze_id: parseInt(raw.id, 10),
      first_name: raw.first_name?.trim() || '',
      last_name: raw.last_name?.trim() || '',
      email: extract(d, FIELD.email),
      phone: extract(d, FIELD.phone),
      address: extractAddress(d),
      gender: extract(d, FIELD.gender),
      birthdate: bd && !bd.startsWith('0000') ? bd : null,
      group_name: extract(d, FIELD.group),
      pastor: extract(d, FIELD.pastor),
      designation: extract(d, FIELD.designation),
      cell_name: extract(d, FIELD.cell),
      fellowship: extract(d, FIELD.fellowship),
      who_invited: extract(d, FIELD.whoInvited),
      joined_oasis: extract(d, FIELD.joinedOasis),
      baptized: extract(d, FIELD.baptized),
      foundation_school: extract(d, FIELD.foundationSchool),
      foundation_school_grad_year: extract(d, FIELD.foundationSchoolGradYear),
      school: extract(d, FIELD.school),
      major: extract(d, FIELD.major),
      profession: extract(d, FIELD.profession),
      marital_status: extract(d, FIELD.maritalStatus),
      state: extract(d, FIELD.state),
      unique_id: extract(d, FIELD.uniqueId),
    }
  })

  let upserted = 0
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100)
    const { error } = await supabase
      .from('people')
      .upsert(batch, { onConflict: 'church_id,breeze_id' })
    if (error) {
      console.error('People upsert error:', error.message)
    } else {
      upserted += batch.length
      process.stdout.write(`\r  Upserted ${upserted}/${rows.length} people…`)
    }
  }
  console.log(`\nDone — ${upserted} people imported.`)
}

;(async () => {
  try {
    await importEvents()
    await importPeople()
    console.log('\nAll done!')
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})()

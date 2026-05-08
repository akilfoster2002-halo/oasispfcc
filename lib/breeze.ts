// Server-side only — never import from client components

// ── Field IDs from this church's Breeze profile ───────────────────────────────
export const FIELD = {
  phone:                      '715376523',
  email:                      '1561956113',
  address:                    '1173366758',
  gender:                     '1151514576',
  birthdate:                  '1124604630',
  group:                      '1269653662',
  groupId:                    '2054355943',
  pastor:                     '918037587',
  designation:                '2054355940',
  cell:                       '2054356051',
  fellowship:                 '2054355941',
  whoInvited:                 '2054356620',
  joinedOasis:                '2054355938',
  baptized:                   '2054355939',
  foundationSchool:           '2054356050',
  foundationSchoolGradYear:   '2054356052',
  school:                     '2054355942',
  major:                      '1464172649',
  profession:                 '2054355936',
  maritalStatus:              '1593421212',
  state:                      '2054355937',
  uniqueId:                   '2054355944',
} as const

// ── Types ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawDetails = Record<string, any>

export interface BreezePersonRaw {
  id: string
  first_name: string
  last_name: string
  nick_name?: string
  details?: RawDetails
  family?: { details?: { id?: string; first_name?: string; last_name?: string } }[]
}

export interface BreezePerson {
  breeze_id:                  string
  first_name:                 string
  last_name:                  string
  email:                      string | null
  phone:                      string | null
  address:                    string | null
  gender:                     string | null
  birthdate:                  string | null
  group_name:                 string | null
  pastor:                     string | null
  designation:                string | null
  cell_name:                  string | null
  fellowship:                 string | null
  who_invited:                string | null
  joined_oasis:               string | null
  baptized:                   string | null
  foundation_school:          string | null
  foundation_school_grad_year: string | null
  school:                     string | null
  major:                      string | null
  profession:                 string | null
  marital_status:             string | null
  state:                      string | null
  unique_id:                  string | null
}

export interface BreezeEvent {
  id: string
  event_id: string
  name: string
  start_datetime: string
  end_datetime: string
  category_id: string
}

export interface BreezeAttendanceRecord {
  instance_id: string
  person_id:   string
  created_on:  string   // check-in time: "YYYY-MM-DD HH:MM:SS"
  check_out:   string   // "0000-00-00 00:00:00" = still checked in; real timestamp = checked out
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBaseUrl() {
  const sub = process.env.BREEZE_SUBDOMAIN
  if (!sub) throw new Error('BREEZE_SUBDOMAIN is not set')
  return `https://${sub}.breezechms.com/api`
}

function headers() {
  const key = process.env.BREEZE_API_KEY
  if (!key) throw new Error('BREEZE_API_KEY is not set')
  return { 'Api-Key': key, 'Content-Type': 'application/json' }
}

// Handles: string, { name } (multiple_choice), array of phone/email/address objects
function extractField(d: RawDetails, fieldId: string): string | null {
  const val = d?.[fieldId]
  if (val === null || val === undefined || val === '') return null

  // Plain string (single_line, birthdate, etc.)
  if (typeof val === 'string') return val.trim() || null

  // Multiple-choice: { value, name }
  if (typeof val === 'object' && !Array.isArray(val) && 'name' in val)
    return (val.name as string) || null

  // Array — phone: [{ phone_number }], email: [{ address }]
  if (Array.isArray(val)) {
    for (const item of val) {
      if (item?.phone_number?.trim()) return item.phone_number.trim()
      if (item?.address?.trim()) return item.address.trim()
    }
    return null
  }

  return null
}

function extractAddress(d: RawDetails): string | null {
  const val = d?.[FIELD.address]
  if (!val) return null

  // Array of address objects
  const items = Array.isArray(val) ? val : [val]
  for (const item of items) {
    const parts = [item.street_address, item.city, item.state, item.zip].filter(Boolean)
    if (parts.length > 0) return parts.join(', ')
  }
  return null
}

export function parsePerson(raw: BreezePersonRaw): BreezePerson {
  const d: RawDetails = raw.details ?? {}
  return {
    breeze_id:                  raw.id,
    first_name:                 raw.first_name?.trim() || '',
    last_name:                  raw.last_name?.trim()  || '',
    email:                      extractField(d, FIELD.email),
    phone:                      extractField(d, FIELD.phone),
    address:                    extractAddress(d),
    gender:                     extractField(d, FIELD.gender),
    birthdate:                  extractField(d, FIELD.birthdate) ?? (d.birthdate as string | null) ?? null,
    group_name:                 extractField(d, FIELD.group),
    pastor:                     extractField(d, FIELD.pastor),
    designation:                extractField(d, FIELD.designation),
    cell_name:                  extractField(d, FIELD.cell),
    fellowship:                 extractField(d, FIELD.fellowship),
    who_invited:                extractField(d, FIELD.whoInvited),
    joined_oasis:               extractField(d, FIELD.joinedOasis),
    baptized:                   extractField(d, FIELD.baptized),
    foundation_school:          extractField(d, FIELD.foundationSchool),
    foundation_school_grad_year: extractField(d, FIELD.foundationSchoolGradYear),
    school:                     extractField(d, FIELD.school),
    major:                      extractField(d, FIELD.major),
    profession:                 extractField(d, FIELD.profession),
    marital_status:             extractField(d, FIELD.maritalStatus),
    state:                      extractField(d, FIELD.state),
    unique_id:                  extractField(d, FIELD.uniqueId),
  }
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchAllPeople(onProgress?: (fetched: number) => void): Promise<BreezePerson[]> {
  const all: BreezePerson[] = []
  const limit = 500
  let offset  = 0

  while (true) {
    const url = `${getBaseUrl()}/people?limit=${limit}&offset=${offset}&details=1`
    const res = await fetch(url, { headers: headers() })
    if (!res.ok) throw new Error(`Breeze people fetch failed: ${res.status} ${await res.text()}`)
    const page: BreezePersonRaw[] = await res.json()
    if (!Array.isArray(page) || page.length === 0) break
    all.push(...page.map(parsePerson))
    offset += page.length
    onProgress?.(all.length)
    if (page.length < limit) break
  }

  return all
}

export async function fetchEvents(from: string, to: string): Promise<BreezeEvent[]> {
  const url = `${getBaseUrl()}/events?start=${from}&end=${to}&limit=500`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error(`Breeze events fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchEventAttendance(instanceId: string): Promise<BreezeAttendanceRecord[]> {
  const url = `${getBaseUrl()}/events/attendance/list?instance_id=${instanceId}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []
  return (data as BreezeAttendanceRecord[]).filter(r => r.person_id)
}

// Parse a Breeze datetime string "YYYY-MM-DD HH:MM:SS" to ISO 8601.
// Returns null for the null-sentinel "0000-00-00 00:00:00" or empty strings.
export function parseBreezeTimestamp(ts: string | undefined | null): string | null {
  if (!ts || ts.startsWith('0000-00-00')) return null
  return ts.replace(' ', 'T') + 'Z'
}

// Get all attendance records for a specific person (by their Breeze ID).
// NOTE: person_id is not in the official Breeze docs for this endpoint — use with care.
export async function fetchPersonAttendance(breezePersonId: string): Promise<BreezeAttendanceRecord[]> {
  const url = `${getBaseUrl()}/events/attendance/list?person_id=${breezePersonId}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []
  return (data as BreezeAttendanceRecord[]).filter(r => r.person_id)
}

// Fetch people from Breeze filtered by a profile field, using filter_json for server-side filtering.
// Falls back to client-side filtering if Breeze returns all people (e.g. filter_json not supported).
export async function fetchPeopleFiltered(opts: {
  fellowship?: string
  group_name?: string
  pastor?: string
}): Promise<BreezePerson[]> {
  const filters: Record<string, unknown> = {}
  if (opts.fellowship)   filters[FIELD.fellowship] = { operator_type: 'CONTAINS', values: [opts.fellowship] }
  else if (opts.group_name) filters[FIELD.group]  = { operator_type: 'CONTAINS', values: [opts.group_name] }
  else if (opts.pastor)     filters[FIELD.pastor]  = { operator_type: 'CONTAINS', values: [opts.pastor] }
  else return []

  const url = `${getBaseUrl()}/people?details=1&limit=500&filter_json=${encodeURIComponent(JSON.stringify(filters))}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error(`Breeze people filter request failed: ${res.status}`)
  const raw: BreezePersonRaw[] = await res.json()
  if (!Array.isArray(raw)) return []

  const people = raw.map(parsePerson)

  // Client-side filter as safety net in case server-side filter_json was ignored
  if (opts.fellowship) {
    const v = opts.fellowship.toLowerCase()
    return people.filter(p => p.fellowship?.toLowerCase().includes(v))
  }
  if (opts.group_name) {
    const v = opts.group_name.toLowerCase()
    return people.filter(p => p.group_name?.toLowerCase().includes(v))
  }
  if (opts.pastor) {
    const v = opts.pastor.toLowerCase()
    return people.filter(p => p.pastor?.toLowerCase().includes(v))
  }
  return people
}

// Run up to `limit` async tasks concurrently
async function concurrent<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0
  async function worker() {
    while (next < tasks.length) {
      const i = next++
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

export type ServiceType = 'sunday_inperson' | 'sunday_online' | 'midweek' | 'cell' | 'other'

export function classifyServiceType(name: string): ServiceType {
  const n = (name ?? '').toLowerCase()
  if (n.includes('sunday') && (n.includes('online') || n.includes('stream'))) return 'sunday_online'
  if (n.includes('sunday')) return 'sunday_inperson'
  if (n.includes('wednesday') || n.includes('midweek') || n.includes('wed')) return 'midweek'
  if (n.includes('cell') || n.includes('small group')) return 'cell'
  return 'other'
}

export interface BreezeEventRecord {
  instanceId:        string
  name:              string
  date:              string
  serviceType:       ServiceType
  attendanceRecords: BreezeAttendanceRecord[]
}

// Fetch all events in a date range with their full attendance records.
// Fetches attendance for up to 8 events concurrently.
export async function fetchEventsWithAttendance(
  from: string,
  to: string,
  onProgress?: (done: number, total: number) => void
): Promise<BreezeEventRecord[]> {
  const events = await fetchEvents(from, to)
  let done = 0
  const records = await concurrent(
    events.map(event => async () => {
      const attendanceRecords = await fetchEventAttendance(event.id)
      onProgress?.(++done, events.length)
      return {
        instanceId: event.id,
        name: event.name,
        date: event.start_datetime?.split('T')[0] ?? from,
        serviceType: classifyServiceType(event.name),
        attendanceRecords,
      } satisfies BreezeEventRecord
    }),
    8
  )
  return records
}

// Bulk attendance sync: fetch all events in a date range, then get attendance per event.
// Calls onProgress(fetched, total) after each event. Returns map of instance_id → records.
export async function fetchAttendanceByDateRange(
  from: string,
  to: string,
  onProgress?: (fetched: number, total: number) => void
): Promise<Map<string, { event: BreezeEvent; attendanceRecords: BreezeAttendanceRecord[] }>> {
  const events = await fetchEvents(from, to)
  const result = new Map<string, { event: BreezeEvent; attendanceRecords: BreezeAttendanceRecord[] }>()

  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    const attendanceRecords = await fetchEventAttendance(event.id)
    result.set(event.id, { event, attendanceRecords })
    onProgress?.(i + 1, events.length)
  }

  return result
}

import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServer } from '@/lib/supabase-server'

function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set')
  return new Anthropic({ apiKey })
}

const SYSTEM_PROMPT = `You are Oasis Assistant, an AI helper for Oasis PFCC — a church management system.
You help church staff and leaders answer questions about their congregation, attendance, groups, and events.
You have access to tools that query the live church database. Always use a tool to answer — never say you can't without trying first.

## DATA STRUCTURE — read this carefully

The database has two distinct types of gatherings:

### Church Services (large gatherings)
Stored in the meetings table with these service_type values:
- "sunday_inperson" — Sunday in-person service
- "sunday_online" — Sunday online stream
- "midweek" — Wednesday/midweek service

### Cell Meetings (small groups)
Stored in the meetings table with service_type = "cell".
IMPORTANT: For cell meetings, the "title" field contains the cell group's name (e.g. "York Cell", "Northside Cell").
Each cell group holds multiple sessions over time — one row per session.
Cell meetings are completely separate from Sunday/midweek services.

## PEOPLE PROFILE DATA (from Breeze sync)
Each person may have enriched fields: designation (First timer/Member/Worker), group_name, pastor, cell_name, baptized, who_invited, joined_oasis, foundation_school, phone, email, gender, profession.

## TOOL SELECTION GUIDE

| Question | Tool |
|---|---|
| Member list, filter by designation/pastor/group/baptism/cell | get_people |
| Sunday or midweek attendance per date | get_attendance (service_type: sunday_inperson/sunday_online/midweek) |
| Cell meeting attendance per date | get_attendance (service_type: "cell") |
| Top cells / cell group rankings / cell stats | get_cell_stats |
| Who attends a specific cell / top people in a cell | get_cell_attendees |
| People who attend X but NOT Y / both X and Y | cross_service_analysis |
| Which cells overlap most with Sunday/midweek / best cells at inviting | cell_service_overlap |
| One person's full profile + attendance history | get_person_attendance |
| Who attended X times, first-timers (by attendance), lapsed, regulars | analyze_members |
| Organizational group/cell structure | get_groups |

Rules:
- "first timers", "members", "workers", "not baptized", "Pastor X's people", "group Y members" → get_people with the right filter
- "top cells", "most attended cell" → get_cell_stats
- "who attends X cell", "top people in X cell" → get_cell_attendees
- "people in X who never attended Y" → cross_service_analysis (mode: "difference")
- "people who attend both X and Y" → cross_service_analysis (mode: "intersection")
- "which cells bring people to midweek/Sunday" → cell_service_overlap
- "who only came once / lapsed / regulars" → analyze_members
- Never say you can't answer without trying a tool first
- NEVER loop through individuals or cells one at a time — always use a bulk tool

Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`

const tools: Anthropic.Tool[] = [
  {
    name: 'get_people',
    description: 'Search/filter members by name or profile fields. Use filters to answer questions like "who are the first timers", "Pastor Joshua\'s members", "unbaptized members", "Trailblazers group", "who was invited by X".',
    input_schema: {
      type: 'object' as const,
      properties: {
        first_name:         { type: 'string', description: 'Partial first name match' },
        last_name:          { type: 'string', description: 'Partial last name match' },
        designation:        { type: 'string', description: 'Filter by designation e.g. "First timer", "Member", "Worker"' },
        pastor:             { type: 'string', description: 'Filter by assigned pastor e.g. "Pastor Joshua"' },
        group_name:         { type: 'string', description: 'Filter by church group e.g. "Trailblazers"' },
        cell_name:          { type: 'string', description: 'Filter by cell group name (partial match)' },
        baptized:           { type: 'string', description: 'Filter by baptism status e.g. "Yes", "No"' },
        who_invited:        { type: 'string', description: 'Filter by who invited them (partial match)' },
        foundation_school:  { type: 'string', description: 'Filter by foundation school completion' },
        not_baptized:       { type: 'boolean', description: 'Set true to return only people who have NOT been baptized' },
        limit:              { type: 'number', description: 'Max results (default 50)' },
      },
    },
  },
  {
    name: 'get_attendance',
    description: 'Get per-meeting attendance counts. Use service_type to filter to Sunday vs midweek.',
    input_schema: {
      type: 'object' as const,
      properties: {
        service_type: { type: 'string', description: '"sunday_inperson", "sunday_online", or "midweek"' },
        from_date: { type: 'string', description: 'ISO date e.g. 2025-01-01' },
        to_date:   { type: 'string', description: 'ISO date e.g. 2025-12-31' },
        limit: { type: 'number', description: 'Max meetings to return (default 10)' },
      },
    },
  },
  {
    name: 'get_person_attendance',
    description: 'Get a specific individual\'s full service history. Use first_name + last_name to identify them.',
    input_schema: {
      type: 'object' as const,
      properties: {
        first_name:   { type: 'string' },
        last_name:    { type: 'string' },
        service_type: { type: 'string', description: '"sunday_inperson", "sunday_online", or "midweek"' },
        from_date:    { type: 'string' },
        to_date:      { type: 'string' },
      },
    },
  },
  {
    name: 'analyze_members',
    description: `Bulk attendance analysis across the whole congregation. Use this for:
- "who only came once" → analysis_type: "low_attendance", attendance_threshold: 1
- "first-time visitors" → analysis_type: "first_time"
- "who stopped coming / lapsed members" → analysis_type: "lapsed"
- "regular attenders" → analysis_type: "regular"
- "attendance overview / stats" → analysis_type: "summary"
Always provide from_date and to_date to define the period.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        analysis_type: {
          type: 'string',
          description: '"summary" | "low_attendance" | "regular" | "first_time" | "lapsed"',
        },
        from_date: { type: 'string', description: 'Start of period e.g. 2025-03-01' },
        to_date:   { type: 'string', description: 'End of period e.g. 2025-04-30' },
        service_type: { type: 'string', description: 'Optional: limit to one service type' },
        attendance_threshold: {
          type: 'number',
          description: 'For low_attendance: max count (default 1). For regular: min count (default 4).',
        },
      },
    },
  },
  {
    name: 'cell_service_overlap',
    description: `For every cell group, calculate how many of their attendees also attended another service type. Ranks cells by their overlap percentage or count. Use for: "which cells are best at bringing people to midweek", "which cells have the most Sunday attendees", "cell to service conversion", "cells that overlap with Sunday/midweek". NEVER loop through cells one by one — this tool does it all in one shot.`,
    input_schema: {
      type: 'object' as const,
      required: ['service_type'],
      properties: {
        service_type: { type: 'string', description: 'The service to check overlap with: "sunday_inperson", "sunday_online", or "midweek"' },
        from_date:    { type: 'string', description: 'Start date (default: 6 months ago)' },
        to_date:      { type: 'string', description: 'End date (default: today)' },
        sort_by:      { type: 'string', description: '"percentage" (default) or "count"' },
      },
    },
  },
  {
    name: 'cross_service_analysis',
    description: `Find people by attendance overlap between two groups/services. Two modes:
- mode "difference" (default): people who attend group A but NOT group B
  - "HOM people who never came to midweek" → in_cell_name: "HOM", not_in_service_type: "midweek"
  - "Sunday regulars who don't attend any cell" → in_service_type: "sunday_inperson", not_in_service_type: "cell"
- mode "intersection": people who attend BOTH group A and group B
  - "HOM members who also go to midweek" → mode: "intersection", in_cell_name: "HOM", also_in_service_type: "midweek"
  - "who are the 16 HOM people that attend midweek" → mode: "intersection", in_cell_name: "HOM", also_in_service_type: "midweek"
Always use this tool for "who attends X but not Y" and "who attends both X and Y" — never loop through individuals.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        mode:            { type: 'string', description: '"difference" (default) — in A but not B | "intersection" — in both A and B' },
        in_service_type: { type: 'string', description: 'Service type for group A (sunday_inperson / sunday_online / midweek / cell)' },
        in_cell_name:    { type: 'string', description: 'Cell name (partial match) for group A' },
        not_in_service_type: { type: 'string', description: '[difference mode] Service type the person must NOT have attended' },
        not_in_cell_name:    { type: 'string', description: '[difference mode] Cell name the person must NOT have attended' },
        also_in_service_type: { type: 'string', description: '[intersection mode] Service type the person MUST ALSO have attended' },
        also_in_cell_name:    { type: 'string', description: '[intersection mode] Cell name the person MUST ALSO have attended' },
        from_date: { type: 'string', description: 'Start of the period to check (default: 12 months ago)' },
        to_date:   { type: 'string', description: 'End of the period to check (default: today)' },
        limit:     { type: 'number', description: 'Max people to return (default: 50)' },
      },
    },
  },
  {
    name: 'get_cell_stats',
    description: `Get attendance stats for cell groups, ranked by total attendance. Each cell group is identified by its meeting title. Use this for: "top cells", "most attended cell", "cell group rankings", "how many people attend each cell", "compare cells".`,
    input_schema: {
      type: 'object' as const,
      properties: {
        from_date: { type: 'string', description: 'Start date e.g. 2025-01-01 (default: 6 months ago)' },
        to_date:   { type: 'string', description: 'End date e.g. 2025-12-31 (default: today)' },
        limit:     { type: 'number', description: 'Number of top cells to return (default: all)' },
      },
    },
  },
  {
    name: 'get_cell_attendees',
    description: `Get the people who attended a specific cell group, ranked by how often they came. Use this for: "who attends X cell", "top people in X cell", "regulars at X", "who comes to HOM". The cell_name is a partial match against the meeting title (e.g. "HOM" matches "HOM USA Cell Meeting").`,
    input_schema: {
      type: 'object' as const,
      required: ['cell_name'],
      properties: {
        cell_name:  { type: 'string', description: 'Partial name of the cell group to search for (e.g. "HOM", "York", "Northside")' },
        from_date:  { type: 'string', description: 'Start date e.g. 2025-01-01 (default: 6 months ago)' },
        to_date:    { type: 'string', description: 'End date e.g. 2025-12-31 (default: today)' },
        limit:      { type: 'number', description: 'Max people to return (default: 20)' },
      },
    },
  },
  {
    name: 'get_groups',
    description: 'Fetch the organizational group/cell membership structure (which members belong to which cell). Does NOT contain attendance data — use get_cell_stats for attendance rankings.',
    input_schema: {
      type: 'object' as const,
      properties: {
        group_name_filter: { type: 'string' },
      },
    },
  },
]

// ── Tool helpers ──────────────────────────────────────────────────────────────

async function getMeetingIds(
  supabase: ReturnType<typeof getSupabaseServer>,
  opts: { from?: string; to?: string; before?: string; serviceType?: string }
): Promise<string[]> {
  let q = supabase.from('meetings').select('id')
  if (opts.from)        q = q.gte('date', opts.from)
  if (opts.to)          q = q.lte('date', opts.to)
  if (opts.before)      q = q.lt('date', opts.before)
  if (opts.serviceType) q = q.eq('service_type', opts.serviceType)
  const { data } = await q
  return (data ?? []).map((m: { id: string }) => m.id)
}

type PersonCount = { name: string; first_name: string; last_name: string; count: number }

function chunkArr<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function getPersonCounts(
  supabase: ReturnType<typeof getSupabaseServer>,
  meetingIds: string[]
): Promise<Map<string, PersonCount>> {
  const map = new Map<string, PersonCount>()
  if (meetingIds.length === 0) return map

  const batches = await Promise.all(
    chunkArr(meetingIds, 80).map(ids =>
      supabase
        .from('attendance')
        .select('person_id, people(id, name, first_name, last_name)')
        .in('meeting_id', ids)
        .eq('present', true)
    )
  )

  for (const { data } of batches) {
    for (const row of (data ?? []) as unknown as { person_id: string; people: { id: string; name: string; first_name: string; last_name: string } | null }[]) {
      if (!row.people) continue
      const p = row.people
      const existing = map.get(row.person_id) ?? { name: p.name, first_name: p.first_name ?? '', last_name: p.last_name ?? '', count: 0 }
      existing.count++
      map.set(row.person_id, existing)
    }
  }
  return map
}

// ── executeTool ───────────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  const supabase = getSupabaseServer()

  // ── get_people ──────────────────────────────────────────────────────────────
  if (name === 'get_people') {
    type PersonRow = {
      first_name: string; last_name: string; name: string; email: string | null
      phone: string | null; designation: string | null; pastor: string | null
      group_name: string | null; cell_name: string | null; baptized: string | null
      who_invited: string | null; joined_oasis: string | null; foundation_school: string | null
      profession: string | null; gender: string | null
    }
    let q = supabase
      .from('people')
      .select('first_name, last_name, name, email, phone, designation, pastor, group_name, cell_name, baptized, who_invited, joined_oasis, foundation_school, profession, gender')
      .order('last_name').order('first_name')
      .limit(Math.min(Number(input.limit ?? 50), 200))

    if (input.first_name)        q = q.ilike('first_name',  `%${input.first_name}%`)
    if (input.last_name)         q = q.ilike('last_name',   `%${input.last_name}%`)
    if (input.designation)       q = q.ilike('designation', `%${input.designation}%`)
    if (input.pastor)            q = q.ilike('pastor',      `%${input.pastor}%`)
    if (input.group_name)        q = q.ilike('group_name',  `%${input.group_name}%`)
    if (input.cell_name)         q = q.ilike('cell_name',   `%${input.cell_name}%`)
    if (input.who_invited)       q = q.ilike('who_invited', `%${input.who_invited}%`)
    if (input.foundation_school) q = q.ilike('foundation_school', `%${input.foundation_school}%`)
    if (input.baptized && !input.not_baptized) q = q.ilike('baptized', `%${input.baptized}%`)
    if (input.not_baptized)      q = q.or('baptized.is.null,baptized.ilike.%No%')

    let { data, error } = await q

    // If extended columns don't exist yet (migration not run), fall back to basic fields
    if (error && error.message.includes('column')) {
      const fallback = await supabase
        .from('people')
        .select('first_name, last_name, name, email')
        .order('last_name').order('first_name')
        .limit(Math.min(Number(input.limit ?? 50), 200))
      if (input.first_name) (fallback as unknown as typeof q) // can't reapply filters on already-built query
      data  = fallback.data as typeof data
      error = fallback.error
      if (!error && data) {
        return JSON.stringify({
          note: 'Extended profile fields (pastor, group, designation) are not yet available — run db/005_breeze_people_fields.sql and the Breeze sync script first.',
          count: data.length,
          people: (data as { first_name: string; last_name: string; name: string }[]).map(p => ({
            name: p.name || `${p.first_name} ${p.last_name}`.trim(),
          })),
        })
      }
    }

    if (error) return `Error: ${error.message}`
    if (!data || data.length === 0) return 'No people found matching those filters.'

    const rows = data as PersonRow[]
    return JSON.stringify({
      count: rows.length,
      people: rows.map(p => ({
        name: p.name || `${p.first_name} ${p.last_name}`.trim(),
        first_name: p.first_name, last_name: p.last_name,
        designation: p.designation, pastor: p.pastor,
        group: p.group_name, cell: p.cell_name,
        baptized: p.baptized, who_invited: p.who_invited,
        joined_oasis: p.joined_oasis, phone: p.phone,
        profession: p.profession,
      })),
    })
  }

  // ── get_attendance ──────────────────────────────────────────────────────────
  if (name === 'get_attendance') {
    const limit = Math.min(Number(input.limit ?? 10), 50)
    let q = supabase
      .from('meetings')
      .select('id, title, date, service_type, cells(name)')
      .order('date', { ascending: false })
      .limit(limit)

    if (input.service_type) q = q.eq('service_type', input.service_type as string)
    if (input.from_date)    q = q.gte('date', input.from_date as string)
    if (input.to_date)      q = q.lte('date', input.to_date   as string)

    const { data: meetings, error } = await q
    if (error) return `Error: ${error.message}`
    if (!meetings || meetings.length === 0) return 'No meetings found.'

    const rows = meetings as unknown as { id: string; title: string; date: string; service_type: string | null; cells: { name: string } | null }[]
    const { data: att } = await supabase.from('attendance').select('meeting_id, present').in('meeting_id', rows.map(m => m.id))

    const attMap = new Map<string, { present: number; absent: number }>()
    for (const a of (att ?? [])) {
      const e = attMap.get(a.meeting_id) ?? { present: 0, absent: 0 }
      if (a.present) e.present++; else e.absent++
      attMap.set(a.meeting_id, e)
    }

    return JSON.stringify({
      count: rows.length,
      meetings: rows.map(m => {
        const a = attMap.get(m.id) ?? { present: 0, absent: 0 }
        const total = a.present + a.absent
        return {
          date: m.date.split('T')[0],
          service_type: m.service_type ?? 'unknown',
          present: a.present,
          total_tracked: total,
          rate: total > 0 ? `${Math.round((a.present / total) * 100)}%` : 'No records',
        }
      }),
    })
  }

  // ── get_person_attendance ───────────────────────────────────────────────────
  if (name === 'get_person_attendance') {
    const profileFields = 'id, first_name, last_name, name, phone, email, birthdate, gender, designation, pastor, group_name, cell_name, baptized, who_invited, joined_oasis, foundation_school, foundation_school_grad_year, school, major, profession, marital_status, state, unique_id, fellowship'
    let pq = supabase.from('people').select(profileFields).limit(5)
    if (input.first_name) pq = pq.ilike('first_name', `%${input.first_name}%`)
    if (input.last_name)  pq = pq.ilike('last_name',  `%${input.last_name}%`)

    const { data: people, error } = await pq
    if (error) return `Error: ${error.message}`
    if (!people || people.length === 0) return 'No person found with that name.'
    if (people.length > 3) return `Multiple matches: ${(people as { name: string }[]).map(p => p.name).join(', ')}. Be more specific.`

    type PersonRow = {
      id: string; first_name: string; last_name: string; name: string
      phone: string | null; email: string | null; birthdate: string | null; gender: string | null
      designation: string | null; pastor: string | null; group_name: string | null; cell_name: string | null
      baptized: string | null; who_invited: string | null; joined_oasis: string | null
      foundation_school: string | null; foundation_school_grad_year: string | null
      school: string | null; major: string | null; profession: string | null
      marital_status: string | null; state: string | null; unique_id: string | null; fellowship: string | null
    }

    const results = []
    for (const person of people as PersonRow[]) {
      const { data: attRows } = await supabase
        .from('attendance')
        .select('present, meetings(id, title, date, service_type)')
        .eq('person_id', person.id)
        .eq('present', true)

      let rows = (attRows ?? []) as unknown as { present: boolean; meetings: { id: string; title: string; date: string; service_type: string | null } | null }[]
      rows = rows.filter(r => r.meetings)
      if (input.service_type) rows = rows.filter(r => r.meetings?.service_type === input.service_type)
      if (input.from_date) rows = rows.filter(r => r.meetings!.date >= (input.from_date as string))
      if (input.to_date)   rows = rows.filter(r => r.meetings!.date <= (input.to_date   as string))

      rows.sort((a, b) => b.meetings!.date.localeCompare(a.meetings!.date))

      const breakdown: Record<string, number> = {}
      for (const r of rows) { const t = r.meetings?.service_type ?? 'unknown'; breakdown[t] = (breakdown[t] ?? 0) + 1 }

      results.push({
        name: person.name,
        first_name: person.first_name,
        last_name: person.last_name,
        phone: person.phone,
        email: person.email,
        birthdate: person.birthdate,
        gender: person.gender,
        designation: person.designation,
        pastor: person.pastor,
        group: person.group_name,
        cell: person.cell_name,
        fellowship: person.fellowship,
        baptized: person.baptized,
        who_invited: person.who_invited,
        joined_oasis: person.joined_oasis,
        foundation_school: person.foundation_school,
        foundation_school_grad_year: person.foundation_school_grad_year,
        school: person.school,
        major: person.major,
        profession: person.profession,
        marital_status: person.marital_status,
        state: person.state,
        unique_id: person.unique_id,
        total_attendances: rows.length,
        breakdown,
        recent_services: rows.slice(0, 20).map(r => ({
          date: r.meetings!.date.split('T')[0],
          type: r.meetings!.service_type ?? 'unknown',
          title: r.meetings!.title,
        })),
      })
    }
    return JSON.stringify(results)
  }

  // ── analyze_members ─────────────────────────────────────────────────────────
  if (name === 'analyze_members') {
    const type      = (input.analysis_type ?? 'summary') as string
    const svcType   = input.service_type as string | undefined
    const threshold = Number(input.attendance_threshold ?? (type === 'regular' ? 4 : 1))

    // Default period: last 2 months → today if not provided
    const now = new Date()
    const twoMonthsAgo = new Date(now); twoMonthsAgo.setMonth(now.getMonth() - 2)
    const fromDate = (input.from_date as string) ?? twoMonthsAgo.toISOString().split('T')[0]
    const toDate   = (input.to_date   as string) ?? now.toISOString().split('T')[0]

    // ── summary ──────────────────────────────────────────────────────────────
    if (type === 'summary') {
      const ids = await getMeetingIds(supabase, { from: fromDate, to: toDate, serviceType: svcType })
      const counts = await getPersonCounts(supabase, ids)
      const vals = Array.from(counts.values())
      const totalAtt = vals.reduce((s, p) => s + p.count, 0)

      return JSON.stringify({
        period: `${fromDate} → ${toDate}`,
        services: ids.length,
        unique_attendees: vals.length,
        total_attendances: totalAtt,
        avg_per_service: ids.length > 0 ? (totalAtt / ids.length).toFixed(1) : 0,
        frequency_breakdown: {
          '1 time':    vals.filter(p => p.count === 1).length,
          '2-3 times': vals.filter(p => p.count >= 2 && p.count <= 3).length,
          '4-6 times': vals.filter(p => p.count >= 4 && p.count <= 6).length,
          '7+ times':  vals.filter(p => p.count >= 7).length,
        },
      })
    }

    // ── low_attendance ────────────────────────────────────────────────────────
    if (type === 'low_attendance') {
      const ids = await getMeetingIds(supabase, { from: fromDate, to: toDate, serviceType: svcType })
      const counts = await getPersonCounts(supabase, ids)
      const results = Array.from(counts.entries())
        .filter(([, p]) => p.count <= threshold)
        .sort((a, b) => a[1].count - b[1].count)

      return JSON.stringify({
        description: `Members who attended ${threshold === 1 ? 'only once' : `${threshold} or fewer times`} between ${fromDate} and ${toDate}`,
        total: results.length,
        people: results.map(([, p]) => ({
          first_name: p.first_name, last_name: p.last_name,
          name: p.name, times_attended: p.count,
        })),
      })
    }

    // ── regular ───────────────────────────────────────────────────────────────
    if (type === 'regular') {
      const ids = await getMeetingIds(supabase, { from: fromDate, to: toDate, serviceType: svcType })
      const counts = await getPersonCounts(supabase, ids)
      const results = Array.from(counts.entries())
        .filter(([, p]) => p.count >= threshold)
        .sort((a, b) => b[1].count - a[1].count)

      return JSON.stringify({
        description: `Members who attended ${threshold}+ times between ${fromDate} and ${toDate}`,
        total: results.length,
        people: results.map(([, p]) => ({
          first_name: p.first_name, last_name: p.last_name,
          name: p.name, times_attended: p.count,
        })),
      })
    }

    // ── lapsed ────────────────────────────────────────────────────────────────
    if (type === 'lapsed') {
      const recentIds = await getMeetingIds(supabase, { from: fromDate, to: toDate, serviceType: svcType })
      const priorIds  = await getMeetingIds(supabase, { before: fromDate, serviceType: svcType })

      const recentSet = new Set((await getPersonCounts(supabase, recentIds)).keys())
      const priorMap  = await getPersonCounts(supabase, priorIds)

      const lapsed = Array.from(priorMap.entries())
        .filter(([id]) => !recentSet.has(id))
        .sort((a, b) => b[1].count - a[1].count)

      return JSON.stringify({
        description: `Members who attended before ${fromDate} but NOT between ${fromDate} and ${toDate}`,
        total: lapsed.length,
        people: lapsed.slice(0, 50).map(([, p]) => ({
          first_name: p.first_name, last_name: p.last_name,
          name: p.name, times_attended_before: p.count,
        })),
      })
    }

    // ── first_time ────────────────────────────────────────────────────────────
    if (type === 'first_time') {
      const recentIds  = await getMeetingIds(supabase, { from: fromDate, to: toDate, serviceType: svcType })
      const recentMap  = await getPersonCounts(supabase, recentIds)
      const recentKeys = Array.from(recentMap.keys())

      if (recentKeys.length === 0) return 'No attendees found in that period.'

      const priorIds = await getMeetingIds(supabase, { before: fromDate, serviceType: svcType })
      const priorSet = new Set((await getPersonCounts(supabase, priorIds)).keys())

      const firstTime = recentKeys
        .filter(id => !priorSet.has(id))
        .map(id => recentMap.get(id)!)

      return JSON.stringify({
        description: `Members who attended for the first time between ${fromDate} and ${toDate}`,
        total: firstTime.length,
        people: firstTime.map(p => ({
          first_name: p.first_name, last_name: p.last_name,
          name: p.name, times_attended: p.count,
        })),
      })
    }

    return `Unknown analysis_type "${type}". Use: summary, low_attendance, regular, lapsed, first_time`
  }

  // ── get_cell_stats ──────────────────────────────────────────────────────────
  if (name === 'get_cell_stats') {
    const now = new Date()
    const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(now.getMonth() - 6)
    const fromDate = (input.from_date as string) ?? sixMonthsAgo.toISOString().split('T')[0]
    const toDate   = (input.to_date   as string) ?? now.toISOString().split('T')[0]
    const limit    = input.limit ? Number(input.limit) : undefined

    // Fetch all cell meetings in range
    const { data: cellMeetings, error: cmErr } = await supabase
      .from('meetings')
      .select('id, title, date')
      .eq('service_type', 'cell')
      .gte('date', fromDate)
      .lte('date', toDate + 'T23:59:59')

    if (cmErr) return `Error: ${cmErr.message}`
    if (!cellMeetings || cellMeetings.length === 0)
      return `No cell meetings found between ${fromDate} and ${toDate}.`

    const meetingRows = cellMeetings as { id: string; title: string; date: string }[]
    const meetingIdToTitle = new Map(meetingRows.map(m => [m.id, m.title ?? 'Unknown']))
    const allIds = meetingRows.map(m => m.id)

    // Fetch attendance (batched)
    const attBatches = await Promise.all(
      chunkArr(allIds, 80).map(ids =>
        supabase.from('attendance').select('meeting_id').in('meeting_id', ids).eq('present', true)
      )
    )
    const allAtt = attBatches.flatMap(r => (r.data ?? []) as { meeting_id: string }[])

    // Aggregate by cell name
    type CellStat = { sessions: number; totalAttendance: number; dates: string[] }
    const cellStats = new Map<string, CellStat>()
    for (const row of allAtt) {
      const title = meetingIdToTitle.get(row.meeting_id) ?? 'Unknown'
      const stat = cellStats.get(title) ?? { sessions: 0, totalAttendance: 0, dates: [] }
      stat.totalAttendance++
      cellStats.set(title, stat)
    }
    // Count sessions per cell
    for (const m of meetingRows) {
      const title = m.title ?? 'Unknown'
      const stat = cellStats.get(title) ?? { sessions: 0, totalAttendance: 0, dates: [] }
      stat.sessions++
      stat.dates.push(m.date.substring(0, 10))
      cellStats.set(title, stat)
    }

    let ranked = Array.from(cellStats.entries())
      .map(([cell, s]) => ({
        cell,
        total_attendance: s.totalAttendance,
        sessions: s.sessions,
        avg_per_session: s.sessions > 0 ? Math.round(s.totalAttendance / s.sessions) : 0,
        last_meeting: s.dates.sort().at(-1),
      }))
      .sort((a, b) => b.total_attendance - a.total_attendance)

    if (limit) ranked = ranked.slice(0, limit)

    return JSON.stringify({
      period: `${fromDate} → ${toDate}`,
      total_cells: ranked.length,
      cells: ranked,
    })
  }

  // ── cell_service_overlap ─────────────────────────────────────────────────────
  if (name === 'cell_service_overlap') {
    const svcType  = input.service_type as string
    const sortBy   = (input.sort_by as string) ?? 'percentage'
    const now      = new Date()
    const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(now.getMonth() - 6)
    const fromDate = (input.from_date as string) ?? sixMonthsAgo.toISOString().split('T')[0]
    const toDate   = (input.to_date   as string) ?? now.toISOString().split('T')[0]

    // 1. All cell meetings in range + their attendees
    const { data: cellMtgs } = await supabase
      .from('meetings').select('id, title')
      .eq('service_type', 'cell')
      .gte('date', fromDate).lte('date', toDate + 'T23:59:59')

    if (!cellMtgs || cellMtgs.length === 0)
      return `No cell meetings found between ${fromDate} and ${toDate}.`

    const cellMtgRows = cellMtgs as { id: string; title: string }[]
    const cellMtgIds  = cellMtgRows.map(m => m.id)
    const idToTitle   = new Map(cellMtgRows.map(m => [m.id, m.title ?? 'Unknown']))

    const cellAttBatches = await Promise.all(
      chunkArr(cellMtgIds, 80).map(ids =>
        supabase.from('attendance').select('meeting_id, person_id').in('meeting_id', ids).eq('present', true)
      )
    )
    const cellAttRows = cellAttBatches.flatMap(r => (r.data ?? []) as { meeting_id: string; person_id: string }[])

    // Build: cellTitle → Set<person_id>
    const cellPersonMap = new Map<string, Set<string>>()
    for (const row of cellAttRows) {
      const title = idToTitle.get(row.meeting_id) ?? 'Unknown'
      const set = cellPersonMap.get(title) ?? new Set<string>()
      set.add(row.person_id)
      cellPersonMap.set(title, set)
    }

    // 2. All attendees of the target service in range
    const { data: svcMtgs } = await supabase
      .from('meetings').select('id')
      .eq('service_type', svcType)
      .gte('date', fromDate).lte('date', toDate + 'T23:59:59')

    const svcMtgIds = (svcMtgs ?? []).map((m: { id: string }) => m.id)
    let svcPersonIds = new Set<string>()

    if (svcMtgIds.length > 0) {
      const svcBatches = await Promise.all(
        chunkArr(svcMtgIds, 80).map(ids =>
          supabase.from('attendance').select('person_id').in('meeting_id', ids).eq('present', true)
        )
      )
      svcPersonIds = new Set(
        svcBatches.flatMap(r => (r.data ?? []).map((a: { person_id: string }) => a.person_id))
      )
    }

    // 3. Calculate overlap per cell
    const SVC_LABEL: Record<string, string> = {
      sunday_inperson: 'Sunday In-Person', sunday_online: 'Sunday Online', midweek: 'Midweek',
    }
    const results = Array.from(cellPersonMap.entries()).map(([cell, members]) => {
      const overlap = [...members].filter(id => svcPersonIds.has(id)).length
      const pct     = members.size > 0 ? Math.round((overlap / members.size) * 100) : 0
      return { cell, cell_members: members.size, also_attend_service: overlap, overlap_pct: pct }
    })

    results.sort((a, b) =>
      sortBy === 'count' ? b.also_attend_service - a.also_attend_service : b.overlap_pct - a.overlap_pct
    )

    return JSON.stringify({
      service_checked: SVC_LABEL[svcType] ?? svcType,
      period: `${fromDate} → ${toDate}`,
      total_cells: results.length,
      service_total_attendees: svcPersonIds.size,
      cells: results,
    })
  }

  // ── cross_service_analysis ───────────────────────────────────────────────────
  if (name === 'cross_service_analysis') {
    const now = new Date()
    const twelveMonthsAgo = new Date(now); twelveMonthsAgo.setFullYear(now.getFullYear() - 1)
    const fromDate = (input.from_date as string) ?? twelveMonthsAgo.toISOString().split('T')[0]
    const toDate   = (input.to_date   as string) ?? now.toISOString().split('T')[0]
    const limit    = Number(input.limit ?? 50)

    // ── Helper: get person IDs for a group ──────────────────────────────────
    async function getPersonIdsForGroup(
      serviceType?: string, cellName?: string
    ): Promise<{ ids: Set<string>; label: string; count: number }> {
      let meetingQuery = supabase.from('meetings').select('id')
        .gte('date', fromDate).lte('date', toDate + 'T23:59:59')
      if (serviceType) meetingQuery = meetingQuery.eq('service_type', serviceType)
      if (cellName)    meetingQuery = meetingQuery.eq('service_type', 'cell').ilike('title', `%${cellName}%`)

      const { data: mtgs } = await meetingQuery
      const mtgIds = (mtgs ?? []).map((m: { id: string }) => m.id)
      if (mtgIds.length === 0) return { ids: new Set(), label: cellName ?? serviceType ?? '?', count: 0 }

      const batches = await Promise.all(
        chunkArr(mtgIds, 80).map(ids =>
          supabase.from('attendance').select('person_id').in('meeting_id', ids).eq('present', true)
        )
      )
      const personIds = new Set(
        batches.flatMap(r => (r.data ?? []).map((a: { person_id: string }) => a.person_id))
      )
      return { ids: personIds, label: cellName ?? serviceType ?? '?', count: personIds.size }
    }

    const mode    = (input.mode as string) === 'intersection' ? 'intersection' : 'difference'
    const inGroup = await getPersonIdsForGroup(input.in_service_type as string | undefined, input.in_cell_name as string | undefined)

    if (inGroup.ids.size === 0)
      return `No attendees found for "${inGroup.label}" in ${fromDate} → ${toDate}.`

    let resultIds: string[]
    let summary: string
    let secondGroup: { label: string; count: number }

    if (mode === 'intersection') {
      const alsoGroup = await getPersonIdsForGroup(input.also_in_service_type as string | undefined, input.also_in_cell_name as string | undefined)
      secondGroup = alsoGroup
      resultIds = [...inGroup.ids].filter(id => alsoGroup.ids.has(id))
      summary = `People who attended both "${inGroup.label}" AND "${alsoGroup.label}" between ${fromDate} and ${toDate}`
    } else {
      const notGroup = await getPersonIdsForGroup(input.not_in_service_type as string | undefined, input.not_in_cell_name as string | undefined)
      secondGroup = notGroup
      resultIds = [...inGroup.ids].filter(id => !notGroup.ids.has(id))
      summary = `People who attended "${inGroup.label}" but NOT "${notGroup.label}" between ${fromDate} and ${toDate}`
    }

    if (resultIds.length === 0)
      return JSON.stringify({ summary, count: 0, people: [] })

    // Fetch names (batched)
    const nameBatches = await Promise.all(
      chunkArr(resultIds, 80).map(ids =>
        supabase.from('people').select('id, name, first_name, last_name').in('id', ids)
      )
    )
    const people = nameBatches.flatMap(r => (r.data ?? []) as { id: string; name: string; first_name: string; last_name: string }[])
      .sort((a, b) => (a.last_name ?? '').localeCompare(b.last_name ?? ''))
      .slice(0, limit)
      .map(p => ({ name: p.name, first_name: p.first_name, last_name: p.last_name }))

    return JSON.stringify({
      summary,
      in_group_total: inGroup.count,
      second_group_total: secondGroup.count,
      result_count: resultIds.length,
      people,
    })
  }

  // ── get_cell_attendees ───────────────────────────────────────────────────────
  if (name === 'get_cell_attendees') {
    const cellName = (input.cell_name as string)?.trim()
    if (!cellName) return 'cell_name is required.'

    const now = new Date()
    const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(now.getMonth() - 6)
    const fromDate = (input.from_date as string) ?? sixMonthsAgo.toISOString().split('T')[0]
    const toDate   = (input.to_date   as string) ?? now.toISOString().split('T')[0]
    const limit    = Number(input.limit ?? 20)

    // Find cell meetings whose title contains the search term
    const { data: cellMeetings, error: cmErr } = await supabase
      .from('meetings')
      .select('id, title, date')
      .eq('service_type', 'cell')
      .ilike('title', `%${cellName}%`)
      .gte('date', fromDate)
      .lte('date', toDate + 'T23:59:59')

    if (cmErr) return `Error: ${cmErr.message}`
    if (!cellMeetings || cellMeetings.length === 0)
      return `No cell meetings found matching "${cellName}" between ${fromDate} and ${toDate}. Try a shorter search term.`

    const meetingRows = cellMeetings as { id: string; title: string; date: string }[]
    const uniqueTitles = [...new Set(meetingRows.map(m => m.title))]
    const allIds = meetingRows.map(m => m.id)

    // Fetch attendance for those meetings (batched)
    const attBatches = await Promise.all(
      chunkArr(allIds, 80).map(ids =>
        supabase
          .from('attendance')
          .select('person_id, people(id, name, first_name, last_name)')
          .in('meeting_id', ids)
          .eq('present', true)
      )
    )

    type AttRow = { person_id: string; people: { id: string; name: string; first_name: string; last_name: string } | null }
    const allAtt = attBatches.flatMap(r => (r.data ?? []) as unknown as AttRow[])

    const personMap = new Map<string, { name: string; first_name: string; last_name: string; count: number }>()
    for (const row of allAtt) {
      if (!row.people) continue
      const p = row.people
      const rec = personMap.get(row.person_id) ?? { name: p.name, first_name: p.first_name ?? '', last_name: p.last_name ?? '', count: 0 }
      rec.count++
      personMap.set(row.person_id, rec)
    }

    const ranked = Array.from(personMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(p => ({ name: p.name, first_name: p.first_name, last_name: p.last_name, times_attended: p.count }))

    return JSON.stringify({
      cell_groups_matched: uniqueTitles,
      period: `${fromDate} → ${toDate}`,
      sessions: allIds.length,
      total_unique_attendees: personMap.size,
      top_attendees: ranked,
    })
  }

  // ── get_groups ──────────────────────────────────────────────────────────────
  if (name === 'get_groups') {
    // Primary: query distinct group_name values from people table (populated by Breeze sync)
    const { data: groupRows, error: gErr } = await supabase
      .from('people')
      .select('group_name, pastor')
      .not('group_name', 'is', null)

    if (!gErr && groupRows && groupRows.length > 0) {
      type GRow = { group_name: string | null; pastor: string | null }
      const rows = groupRows as GRow[]
      const filter = (input.group_name_filter as string | undefined)?.toLowerCase()

      const grouped = new Map<string, { pastors: Set<string>; count: number }>()
      for (const r of rows) {
        const g = r.group_name!
        if (filter && !g.toLowerCase().includes(filter)) continue
        const entry = grouped.get(g) ?? { pastors: new Set(), count: 0 }
        entry.count++
        if (r.pastor) entry.pastors.add(r.pastor)
        grouped.set(g, entry)
      }

      const groups = Array.from(grouped.entries())
        .map(([name, e]) => ({ name, members: e.count, pastors: [...e.pastors] }))
        .sort((a, b) => b.members - a.members)

      return JSON.stringify({ source: 'breeze_sync', total_groups: groups.length, groups })
    }

    // Fallback: old groups table
    const { data, error } = await supabase
      .from('groups').select('id, name, regions(name), cells(id, name, people(id))').order('name')
    if (error || !data || data.length === 0)
      return 'No groups found. Run db/005_breeze_people_fields.sql and the Breeze sync script to populate group data.'

    const rows = data as unknown as { id: string; name: string; regions: { name: string } | null; cells: { id: string; name: string; people: { id: string }[] }[] }[]
    return JSON.stringify({
      count: rows.length,
      groups: rows.map(g => ({
        name: g.name,
        region: g.regions?.name ?? 'No region',
        cells: g.cells.length,
        total_people: g.cells.reduce((s, c) => s + c.people.length, 0),
      })),
    })
  }

  return `Unknown tool: ${name}`
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { messages } = await request.json() as { messages: { role: string; content: string }[] }
    if (!Array.isArray(messages) || messages.length === 0)
      return Response.json({ error: 'messages array is required' }, { status: 400 })

    const anthropic = getAnthropic()

    const history: Anthropic.MessageParam[] = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools,
      messages: history,
    })

    while (response.stop_reason === 'tool_use') {
      const calls = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
        calls.map(async b => ({
          type: 'tool_result' as const,
          tool_use_id: b.id,
          content: await executeTool(b.name, b.input as Record<string, unknown>),
        }))
      )
      history.push({ role: 'assistant', content: response.content })
      history.push({ role: 'user', content: results })

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools,
        messages: history,
      })
    }

    const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    return Response.json({ reply: text?.text ?? "I couldn't generate a response." })
  } catch (err) {
    console.error('Chat API error:', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 })
  }
}

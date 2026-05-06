import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServer } from '@/lib/supabase-server'

function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set')
  return new Anthropic({ apiKey })
}

async function buildSystemPrompt(): Promise<string> {
  const supabase = getSupabaseServer()

  // Fetch church structure from live data
  const { data: peopleData } = await supabase
    .from('people')
    .select('group_name, fellowship, pastor, cell_name')
    .limit(2000)

  type PRow = { group_name: string | null; fellowship: string | null; pastor: string | null; cell_name: string | null }
  const rows = (peopleData ?? []) as PRow[]

  const groupMap  = new Map<string, { pastors: Set<string>; count: number }>()
  const fellowships = new Set<string>()

  for (const r of rows) {
    if (r.fellowship) fellowships.add(r.fellowship)
    if (!r.group_name) continue
    const g = groupMap.get(r.group_name) ?? { pastors: new Set(), count: 0 }
    g.count++
    if (r.pastor) g.pastors.add(r.pastor)
    groupMap.set(r.group_name, g)
  }

  const groupLines = [...groupMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, e]) => `  - ${name} (${e.count} members${e.pastors.size ? ', pastors: ' + [...e.pastors].join(' / ') : ''})`)
    .join('\n') || '  (Breeze sync not yet run)'

  const fellowshipLines = [...fellowships].sort().map(f => `  - ${f}`).join('\n') || '  (Breeze sync not yet run)'

  // Fetch known cell names from meetings
  const { data: cellData } = await supabase
    .from('meetings')
    .select('title')
    .eq('service_type', 'cell')
    .limit(300)

  const cellNames = [...new Set((cellData ?? []).map((r: { title: string }) => r.title))].sort()
  const cellLines = cellNames.map(c => `  - ${c}`).join('\n') || '  (no cell meetings recorded yet)'

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return `You are Oasis Assistant — a precise data retrieval engine for Oasis PFCC church.
You answer using tools that query live data. Never guess. Never say you can't without trying. Always query first.

Today: ${today}

==================================================
CHURCH HIERARCHY (LIVE DATA)
==================================================

Organization: Oasis PFCC

Groups (each has cells and a pastor):
${groupLines}

Known fellowships/campuses (stored in fellowship field):
${fellowshipLines}

Cell groups (stored in meetings table as service_type="cell", each title is a cell name):
${cellLines}

==================================================
DATABASE SCHEMA
==================================================

meetings:
  - service_type: "sunday_inperson" | "sunday_online" | "midweek" | "cell"
  - title: for cell meetings = the cell's name (e.g. "HOM Cell", "York Cell")
  - date: ISO date

people:
  - group_name: which Group they belong to (e.g. "MEGA", "Charm City")
  - fellowship: campus/fellowship sub-label (may also say "Charm City", "Coppin", "Howard")
  - pastor: their assigned pastor
  - cell_name: their Breeze-assigned cell group
  - designation: "First timer" | "Member" | "Worker"
  - baptized, foundation_school, who_invited, joined_oasis
  - phone, email, birthdate, gender, profession, school, major, marital_status, state

attendance:
  - person_id, meeting_id, present (boolean)

==================================================
MANDATORY SCOPE RULES
==================================================

Step 1 — CLASSIFY EVERY QUESTION into one of:
  A. GROUP-LEVEL: "how many Charm City members / MEGA workers attended..."
  B. CELL-LEVEL: "how many people are in HOM cell / York cell..."
  C. CROSS-LEVEL: "which HOM members also attend midweek..."
  D. PERSON-LEVEL: "what is Akil Foster's attendance record..."

Step 2 — NEVER MIX LEVELS:
  - sunday/midweek services ≠ cell meetings — they are tracked separately
  - Charm City at midweek = GROUP-LEVEL: find people where group_name/fellowship LIKE "Charm City",
    then check midweek attendance → use get_group_service_attendance
  - Do NOT say "Charm City cells are not tracked" — that is a different question entirely

Step 3 — EVENT TYPE RULES:
  - sunday_inperson / sunday_online / midweek → large church-wide services
  - cell → small group cell meetings
  NEVER confuse cell meeting attendance with service attendance

==================================================
TOOL ROUTING (follow exactly)
==================================================

| Question type | Tool |
|---|---|
| How many [group/fellowship/pastor's] members attended [service] | get_group_service_attendance |
| List members filtered by group/designation/pastor/cell/baptism | get_people |
| Service attendance counts per meeting date | get_attendance |
| Cell group rankings / top cells by attendance | get_cell_stats |
| Who attends a specific cell / cell member list | get_cell_attendees |
| [Cell] members who also/never attend [service] | cross_service_analysis |
| Which cells drive the most service attendance | cell_service_overlap |
| One person's profile + full history | get_person_attendance |
| Lapsed / first-timers / regulars by attendance count | analyze_members |
| Group/cell org structure overview | get_groups |

Routing rules:
→ "how many Charm City / [any group name] members came to midweek/Sunday"
   → get_group_service_attendance(group_filter: "Charm City", service_type: "midweek")

→ "how many of Pastor X's people attended [service]"
   → get_group_service_attendance(group_filter: "Pastor X", filter_field: "pastor")

→ "who attends [cell name] cell"
   → get_cell_attendees(cell_name: "...")

→ "[cell] members who also attend midweek"
   → cross_service_analysis(mode: "intersection", in_cell_name: "...", also_in_service_type: "midweek")

→ "first timers / members / workers / unbaptized"
   → get_people(designation: "First timer" | "Member" | "Worker") or not_baptized: true

→ "top cells / most active cells"
   → get_cell_stats

→ "which cells send the most people to midweek/Sunday"
   → cell_service_overlap(service_type: "midweek")

NEVER loop person-by-person or cell-by-cell — always use the bulk tool.
NEVER fabricate data. If no tool returns results, say so and explain which query was tried.`
}

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
    description: `Bulk attendance analysis — for the whole church OR filtered to a specific group/fellowship.
Use fellowship or group_name to scope to one group (e.g. "Charm City midweek regulars", "MEGA lapsed members").
- "most consistent [group] midweek attendees / game plan" → analysis_type: "regular", service_type: "midweek", fellowship: "[group]"
- "who only came once" → analysis_type: "low_attendance", attendance_threshold: 1
- "first-time visitors" → analysis_type: "first_time"
- "who stopped coming / lapsed" → analysis_type: "lapsed"
- "regular attenders" → analysis_type: "regular"
- "attendance stats" → analysis_type: "summary"
Always provide from_date and to_date. For game-plan questions use analysis_type: "regular" with low threshold (1) to get all tiers.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        analysis_type: {
          type: 'string',
          description: '"summary" | "low_attendance" | "regular" | "first_time" | "lapsed"',
        },
        fellowship:   { type: 'string', description: 'Filter results to people with this fellowship value (partial match). E.g. "Charm City"' },
        group_name:   { type: 'string', description: 'Filter results to people with this group_name value (partial match). E.g. "MEGA"' },
        from_date:    { type: 'string', description: 'Start of period e.g. 2025-03-01' },
        to_date:      { type: 'string', description: 'End of period e.g. 2025-04-30' },
        service_type: { type: 'string', description: 'Optional: limit to one service type (midweek / sunday_inperson / sunday_online / cell)' },
        attendance_threshold: {
          type: 'number',
          description: 'For low_attendance: max count (default 1). For regular: min count (default 1 for game plans, 4 for strict regulars).',
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
  {
    name: 'get_group_service_attendance',
    description: `Count how many members from a specific fellowship, group, or pastor's congregation attended a service type. Use for: "how many Charm City members came to midweek?", "how many of Pastor Deji's people attended Sunday?", "how many DC fellowship members attend midweek?". Returns total members in the group, how many attended, and the attendance rate.`,
    input_schema: {
      type: 'object' as const,
      required: ['group_filter'],
      properties: {
        group_filter:  { type: 'string', description: 'Fellowship name, group name, or pastor name to filter by (partial match). E.g. "Charm City", "Pastor Deji", "Trailblazers"' },
        filter_field:  { type: 'string', description: '"fellowship" | "group_name" | "pastor" | "any" (default: "any" — searches all three fields)' },
        service_type:  { type: 'string', description: 'Service type to check: midweek, sunday_inperson, sunday_online, cell. Omit for all services.' },
        from_date:     { type: 'string', description: 'Start date YYYY-MM-DD (default: 6 months ago)' },
        to_date:       { type: 'string', description: 'End date YYYY-MM-DD (default: today)' },
        list_names:    { type: 'boolean', description: 'If true, include the names of attendees in the response' },
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

    // Default period: last 12 months → today if not provided
    const now = new Date()
    const twelveMonthsAgo = new Date(now); twelveMonthsAgo.setFullYear(now.getFullYear() - 1)
    const fromDate = (input.from_date as string) ?? twelveMonthsAgo.toISOString().split('T')[0]
    const toDate   = (input.to_date   as string) ?? now.toISOString().split('T')[0]

    // Optional: restrict to a specific fellowship or group
    let groupPersonIds: Set<string> | null = null
    const fellowshipFilter = input.fellowship as string | undefined
    const groupNameFilter  = input.group_name  as string | undefined
    if (fellowshipFilter || groupNameFilter) {
      let gpq = supabase.from('people').select('id').limit(1000)
      if (fellowshipFilter) gpq = gpq.ilike('fellowship', `%${fellowshipFilter}%`)
      if (groupNameFilter)  gpq = gpq.ilike('group_name',  `%${groupNameFilter}%`)
      const { data: gpData } = await gpq
      groupPersonIds = new Set((gpData ?? []).map((r: { id: string }) => r.id))
      if (groupPersonIds.size === 0)
        return `No people found with fellowship "${fellowshipFilter ?? groupNameFilter}". Check the spelling or run the Breeze sync.`
    }

    // Helper: filter a counts map to only group members
    const filterToGroup = (counts: Map<string, PersonCount>): Map<string, PersonCount> => {
      if (!groupPersonIds) return counts
      const filtered = new Map<string, PersonCount>()
      for (const [id, val] of counts) {
        if (groupPersonIds.has(id)) filtered.set(id, val)
      }
      return filtered
    }

    const groupLabel = (fellowshipFilter ?? groupNameFilter)
      ? ` (${fellowshipFilter ?? groupNameFilter} only)`
      : ''

    // ── summary ──────────────────────────────────────────────────────────────
    if (type === 'summary') {
      const ids    = await getMeetingIds(supabase, { from: fromDate, to: toDate, serviceType: svcType })
      const counts = filterToGroup(await getPersonCounts(supabase, ids))
      const vals   = Array.from(counts.values())
      const totalAtt = vals.reduce((s, p) => s + p.count, 0)

      return JSON.stringify({
        group: groupLabel || 'all',
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
      const ids    = await getMeetingIds(supabase, { from: fromDate, to: toDate, serviceType: svcType })
      const counts = filterToGroup(await getPersonCounts(supabase, ids))
      const results = Array.from(counts.entries())
        .filter(([, p]) => p.count <= threshold)
        .sort((a, b) => a[1].count - b[1].count)

      return JSON.stringify({
        description: `${groupLabel}Members who attended ${threshold === 1 ? 'only once' : `${threshold} or fewer times`} between ${fromDate} and ${toDate}`,
        total: results.length,
        people: results.map(([, p]) => ({
          first_name: p.first_name, last_name: p.last_name,
          name: p.name, times_attended: p.count,
        })),
      })
    }

    // ── regular ───────────────────────────────────────────────────────────────
    if (type === 'regular') {
      const ids    = await getMeetingIds(supabase, { from: fromDate, to: toDate, serviceType: svcType })
      const counts = filterToGroup(await getPersonCounts(supabase, ids))
      const results = Array.from(counts.entries())
        .filter(([, p]) => p.count >= threshold)
        .sort((a, b) => b[1].count - a[1].count)

      return JSON.stringify({
        description: `${groupLabel}Members who attended ${threshold}+ times between ${fromDate} and ${toDate}`,
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

      const recentSet = new Set(filterToGroup(await getPersonCounts(supabase, recentIds)).keys())
      const priorMap  = filterToGroup(await getPersonCounts(supabase, priorIds))

      const lapsed = Array.from(priorMap.entries())
        .filter(([id]) => !recentSet.has(id))
        .sort((a, b) => b[1].count - a[1].count)

      return JSON.stringify({
        description: `${groupLabel}Members who attended before ${fromDate} but NOT between ${fromDate} and ${toDate}`,
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
      const recentMap  = filterToGroup(await getPersonCounts(supabase, recentIds))
      const recentKeys = Array.from(recentMap.keys())

      if (recentKeys.length === 0) return 'No attendees found in that period.'

      const priorIds = await getMeetingIds(supabase, { before: fromDate, serviceType: svcType })
      const priorSet = new Set(filterToGroup(await getPersonCounts(supabase, priorIds)).keys())

      const firstTime = recentKeys
        .filter(id => !priorSet.has(id))
        .map(id => recentMap.get(id)!)

      return JSON.stringify({
        description: `${groupLabel}Members who attended for the first time between ${fromDate} and ${toDate}`,
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

  // ── get_group_service_attendance ─────────────────────────────────────────────
  if (name === 'get_group_service_attendance') {
    const groupFilter = (input.group_filter as string).trim()
    const filterField = (input.filter_field as string | undefined) ?? 'any'
    const serviceType = input.service_type as string | undefined
    const listNames   = Boolean(input.list_names)

    // Default date range: last 6 months
    const now = new Date()
    const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(now.getMonth() - 6)
    const fromDate = (input.from_date as string | undefined) ?? sixMonthsAgo.toISOString().split('T')[0]
    const toDate   = (input.to_date   as string | undefined) ?? now.toISOString().split('T')[0]

    // Step 1: Find people matching the group filter
    let pq = supabase.from('people').select('id, name').limit(600)
    if (filterField === 'fellowship') {
      pq = pq.ilike('fellowship', `%${groupFilter}%`)
    } else if (filterField === 'group_name') {
      pq = pq.ilike('group_name', `%${groupFilter}%`)
    } else if (filterField === 'pastor') {
      pq = pq.ilike('pastor', `%${groupFilter}%`)
    } else {
      pq = pq.or(`fellowship.ilike.%${groupFilter}%,group_name.ilike.%${groupFilter}%,pastor.ilike.%${groupFilter}%`)
    }

    const { data: matchedPeople, error: pErr } = await pq
    if (pErr) return `Error fetching people: ${pErr.message}`
    if (!matchedPeople || matchedPeople.length === 0)
      return `No members found matching "${groupFilter}". Try a different name or check the fellowship/group/pastor fields.`

    type PRow = { id: string; name: string }
    const personIds = (matchedPeople as PRow[]).map(p => p.id)
    const personNameMap = new Map((matchedPeople as PRow[]).map(p => [p.id, p.name]))

    // Step 2: Get meeting IDs for the service type and date range
    let mq = supabase.from('meetings').select('id').gte('date', fromDate).lte('date', toDate).limit(500)
    if (serviceType) mq = mq.eq('service_type', serviceType)
    const { data: meetings, error: mErr } = await mq
    if (mErr) return `Error fetching meetings: ${mErr.message}`
    if (!meetings || meetings.length === 0)
      return `No ${serviceType ?? 'any'} meetings found between ${fromDate} and ${toDate}.`

    const meetingIds = (meetings as { id: string }[]).map(m => m.id)

    // Step 3: Count attendance at intersection of those people + those meetings
    const attendedIds = new Set<string>()
    for (const pBatch of chunkArr(personIds, 80)) {
      for (const mBatch of chunkArr(meetingIds, 80)) {
        const { data: attRows } = await supabase
          .from('attendance')
          .select('person_id')
          .in('person_id', pBatch)
          .in('meeting_id', mBatch)
          .eq('present', true)
        if (attRows) for (const r of attRows as { person_id: string }[]) attendedIds.add(r.person_id)
      }
    }

    const result: Record<string, unknown> = {
      group_filter:            groupFilter,
      filter_field:            filterField,
      service_type:            serviceType ?? 'all services',
      period:                  `${fromDate} to ${toDate}`,
      total_members_in_group:  personIds.length,
      members_who_attended:    attendedIds.size,
      attendance_rate:         personIds.length > 0
        ? `${Math.round((attendedIds.size / personIds.length) * 100)}%`
        : '0%',
    }

    if (listNames) {
      result.attendee_names = Array.from(attendedIds).map(id => personNameMap.get(id) ?? id).sort()
      result.non_attendees  = personIds.filter(id => !attendedIds.has(id)).map(id => personNameMap.get(id) ?? id).sort()
    }

    return JSON.stringify(result)
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
    const systemPrompt = await buildSystemPrompt()

    const history: Anthropic.MessageParam[] = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
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
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
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

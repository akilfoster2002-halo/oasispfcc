import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServer } from '@/lib/supabase-server'

function getAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({ apiKey: key })
}

// ── System prompt (1-hour cache) ──────────────────────────────
let _promptCache: { prompt: string; expires: number } | null = null

async function buildSystemPrompt(): Promise<string> {
  if (_promptCache && Date.now() < _promptCache.expires) return _promptCache.prompt

  const supabase = getSupabaseServer()

  const [{ data: groups }, { count: totalAttendees }, { count: totalMeetings }, { count: totalAttendance }] =
    await Promise.all([
      supabase.from('groups').select('name').order('name'),
      supabase.from('attendees').select('*', { count: 'exact', head: true }),
      supabase.from('meetings').select('*', { count: 'exact', head: true }),
      supabase.from('attendance').select('*', { count: 'exact', head: true }),
    ])

  const groupNames = (groups ?? []).map(g => g.name).join(', ')

  const prompt = `You are the Oasis PFCC Church Intelligence Assistant. You help church leadership understand attendance patterns, member engagement, and group health.

DATABASE OVERVIEW:
- Groups: ${groupNames}
- Total attendees tracked: ${totalAttendees ?? 0}
- Total meetings in system: ${totalMeetings ?? 0}
- Total attendance records: ${totalAttendance ?? 0}

SCHEMA:
- groups: id, name
- meetings: id, group_id, meeting_date, meeting_type (Sunday/Wednesday/Cell/Prayer/Special/Other), name
- attendees: id, name (breeze_id is internal only)
- attendance: meeting_id, attendee_id, status (present/absent/late)

CAPABILITIES:
You can answer questions about attendance consistency, who has or hasn't been coming, meeting headcounts, trends over time, and group transfers (people attending different groups).

GUIDELINES:
- Default date range: last 90 days unless user specifies otherwise
- When asked about a person, search by name (case-insensitive partial match)
- When asked about a group, match group names partially (e.g. "charm" → CharmCity)
- Always clarify the date range and group in your answers
- For transfers: someone who attended Group A before but now attends Group B is a transfer
- Today's date: ${new Date().toISOString().split('T')[0]}`

  _promptCache = { prompt, expires: Date.now() + 60 * 60 * 1000 }
  return prompt
}

// ── Tool definitions ──────────────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: 'get_groups',
    description: 'List all ministry groups with their meeting counts and date ranges.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_meeting_headcounts',
    description: 'Get attendance headcounts per meeting for a group and date range. Use to see trends, best/worst attended meetings.',
    input_schema: {
      type: 'object' as const,
      properties: {
        group_name:   { type: 'string', description: 'Partial group name, or omit for all groups' },
        meeting_type: { type: 'string', description: 'Sunday, Wednesday, Cell, Prayer, Special, Other — or omit for all' },
        from_date:    { type: 'string', description: 'YYYY-MM-DD' },
        to_date:      { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['from_date', 'to_date'],
    },
  },
  {
    name: 'get_attendance_summary',
    description: 'Get per-person attendance counts for a group + date range. Use to find consistent attenders, low attenders, or search for a specific person.',
    input_schema: {
      type: 'object' as const,
      properties: {
        group_name:   { type: 'string', description: 'Partial group name, or omit for all groups' },
        meeting_type: { type: 'string', description: 'Filter by meeting type, or omit for all' },
        from_date:    { type: 'string', description: 'YYYY-MM-DD' },
        to_date:      { type: 'string', description: 'YYYY-MM-DD' },
        min_count:    { type: 'number', description: 'Only return people who attended at least this many times' },
        max_count:    { type: 'number', description: 'Only return people who attended at most this many times' },
        name_search:  { type: 'string', description: 'Filter results to a specific person by partial name' },
        limit:        { type: 'number', description: 'Max results to return (default 50)' },
      },
      required: ['from_date', 'to_date'],
    },
  },
  {
    name: 'get_person_history',
    description: 'Get the full attendance history for a specific person across all groups. Use to see every meeting they attended.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name:      { type: 'string', description: 'Person\'s full or partial name' },
        from_date: { type: 'string', description: 'YYYY-MM-DD' },
        to_date:   { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['name'],
    },
  },
  {
    name: 'detect_transfers',
    description: 'Find people who attend multiple groups or whose attendance has shifted from one group to another — potential transfers.',
    input_schema: {
      type: 'object' as const,
      properties: {
        from_date: { type: 'string', description: 'YYYY-MM-DD' },
        to_date:   { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['from_date', 'to_date'],
    },
  },
  {
    name: 'get_lapsed_members',
    description: 'Find people who attended before a cutoff date but have NOT attended since. Use to identify who has gone missing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        group_name:    { type: 'string', description: 'Partial group name, or omit for all' },
        meeting_type:  { type: 'string', description: 'Filter by meeting type, or omit for all' },
        active_before: { type: 'string', description: 'YYYY-MM-DD — person must have attended before this date' },
        absent_since:  { type: 'string', description: 'YYYY-MM-DD — person must have zero attendance from this date onward' },
      },
      required: ['active_before', 'absent_since'],
    },
  },
  {
    name: 'get_first_timers',
    description: 'Find people who attended for the first time within a date range (no attendance before that range).',
    input_schema: {
      type: 'object' as const,
      properties: {
        group_name:  { type: 'string', description: 'Partial group name, or omit for all' },
        from_date:   { type: 'string', description: 'YYYY-MM-DD — start of window to look for first appearances' },
        to_date:     { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['from_date', 'to_date'],
    },
  },
]

// ── Tool execution ────────────────────────────────────────────
async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  const supabase = getSupabaseServer()

  const today = new Date().toISOString().split('T')[0]
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  if (name === 'get_groups') {
    const { data: groups } = await supabase.from('groups').select('id, name').order('name')
    const results = []
    for (const g of groups ?? []) {
      const { count: meetings } = await supabase
        .from('meetings').select('*', { count: 'exact', head: true }).eq('group_id', g.id)
      const { data: range } = await supabase
        .from('meetings').select('meeting_date').eq('group_id', g.id)
        .order('meeting_date', { ascending: true }).limit(1)
      const { data: rangeEnd } = await supabase
        .from('meetings').select('meeting_date').eq('group_id', g.id)
        .order('meeting_date', { ascending: false }).limit(1)
      results.push({
        name: g.name,
        total_meetings: meetings ?? 0,
        first_meeting: range?.[0]?.meeting_date ?? null,
        last_meeting: rangeEnd?.[0]?.meeting_date ?? null,
      })
    }
    return results
  }

  if (name === 'get_meeting_headcounts') {
    const { data, error } = await supabase.rpc('meeting_headcounts', {
      p_group_name:   input.group_name   ?? null,
      p_meeting_type: input.meeting_type ?? null,
      p_from_date:    input.from_date    ?? ninetyDaysAgo,
      p_to_date:      input.to_date      ?? today,
    })
    if (error) return { error: error.message }
    return data ?? []
  }

  if (name === 'get_attendance_summary') {
    const { data, error } = await supabase.rpc('attendance_summary', {
      p_group_name:   input.group_name   ?? null,
      p_meeting_type: input.meeting_type ?? null,
      p_from_date:    input.from_date    ?? ninetyDaysAgo,
      p_to_date:      input.to_date      ?? today,
    })
    if (error) return { error: error.message }
    let results = (data ?? []) as { name: string; times_attended: number; first_seen: string; last_seen: string }[]
    if (input.name_search) {
      const q = (input.name_search as string).toLowerCase()
      results = results.filter(r => r.name.toLowerCase().includes(q))
    }
    if (input.min_count !== undefined) results = results.filter(r => r.times_attended >= (input.min_count as number))
    if (input.max_count !== undefined) results = results.filter(r => r.times_attended <= (input.max_count as number))
    const limit = (input.limit as number) ?? 50
    return results.slice(0, limit)
  }

  if (name === 'get_person_history') {
    const nameQ = `%${input.name}%`
    const { data: people } = await supabase
      .from('attendees').select('id, name').ilike('name', nameQ).limit(5)
    if (!people?.length) return { message: `No attendee found matching "${input.name}"` }

    const results = []
    for (const person of people) {
      let query = supabase
        .from('attendance')
        .select('status, meetings(meeting_date, meeting_type, name, groups(name))')
        .eq('attendee_id', person.id)
        .order('meetings(meeting_date)', { ascending: false })

      if (input.from_date) query = query.gte('meetings.meeting_date', input.from_date as string)
      if (input.to_date)   query = query.lte('meetings.meeting_date', input.to_date as string)

      const { data: history } = await query
      results.push({
        name: person.name,
        total_attended: history?.filter(h => h.status === 'present').length ?? 0,
        meetings: (history ?? []).map(h => {
          const mtg = h.meetings as unknown as { meeting_date: string; meeting_type: string; name: string; groups: { name: string } }
          return {
            date:   mtg?.meeting_date,
            type:   mtg?.meeting_type,
            event:  mtg?.name,
            group:  mtg?.groups?.name,
            status: h.status,
          }
        }),
      })
    }
    return results.length === 1 ? results[0] : results
  }

  if (name === 'detect_transfers') {
    const { data, error } = await supabase.rpc('detect_transfers', {
      p_from_date: input.from_date ?? ninetyDaysAgo,
      p_to_date:   input.to_date   ?? today,
    })
    if (error) return { error: error.message }
    return data ?? []
  }

  if (name === 'get_lapsed_members') {
    const activeBefore = input.active_before as string
    const absentSince  = input.absent_since  as string

    // People who attended before cutoff
    let priorQuery = supabase
      .from('attendance')
      .select('attendee_id, attendees(name), meetings!inner(meeting_date, groups(name))')
      .eq('status', 'present')
      .lt('meetings.meeting_date', activeBefore)

    if (input.group_name) {
      priorQuery = priorQuery.ilike('meetings.groups.name', `%${input.group_name}%`)
    }
    if (input.meeting_type) {
      priorQuery = priorQuery.ilike('meetings.meeting_type', `%${input.meeting_type}%`)
    }

    const { data: prior } = await priorQuery
    if (!prior?.length) return { message: 'No prior attendees found in that range.' }

    const priorIds = [...new Set(prior.map(r => r.attendee_id))]

    // Of those, who has NOT attended since absentSince?
    const stillActive = new Set<string>()
    for (const batch of chunk(priorIds, 80)) {
      const { data: recent } = await supabase
        .from('attendance')
        .select('attendee_id, meetings!inner(meeting_date)')
        .in('attendee_id', batch)
        .eq('status', 'present')
        .gte('meetings.meeting_date', absentSince)
      for (const r of recent ?? []) stillActive.add(r.attendee_id)
    }

    const lapsed = priorIds
      .filter(id => !stillActive.has(id))
      .map(id => {
        const row = prior.find(r => r.attendee_id === id)
        return { name: (row?.attendees as unknown as { name: string })?.name ?? '?', attendee_id: id }
      })

    return {
      lapsed_count: lapsed.length,
      lapsed: lapsed.slice(0, 100),
    }
  }

  if (name === 'get_first_timers') {
    const fromDate = input.from_date as string
    const toDate   = input.to_date   as string

    let query = supabase
      .from('attendance')
      .select('attendee_id, attendees(name), meetings!inner(meeting_date, groups(name))')
      .eq('status', 'present')
      .gte('meetings.meeting_date', fromDate)
      .lte('meetings.meeting_date', toDate)

    if (input.group_name) {
      query = query.ilike('meetings.groups.name', `%${input.group_name}%`)
    }

    const { data: inPeriod } = await query
    if (!inPeriod?.length) return { message: 'No attendance found in that range.' }

    const periodIds = [...new Set(inPeriod.map(r => r.attendee_id))]

    // Filter to those with NO attendance before fromDate
    const hadPrior = new Set<string>()
    for (const batch of chunk(periodIds, 80)) {
      const { data: prior } = await supabase
        .from('attendance')
        .select('attendee_id, meetings!inner(meeting_date)')
        .in('attendee_id', batch)
        .eq('status', 'present')
        .lt('meetings.meeting_date', fromDate)
      for (const r of prior ?? []) hadPrior.add(r.attendee_id)
    }

    const firstTimers = periodIds
      .filter(id => !hadPrior.has(id))
      .map(id => {
        const row = inPeriod.find(r => r.attendee_id === id)
        const mtg = row?.meetings as unknown as { groups: { name: string } }
        return {
          name:  (row?.attendees as unknown as { name: string })?.name ?? '?',
          group: mtg?.groups?.name ?? '?',
        }
      })

    return { first_timer_count: firstTimers.length, first_timers: firstTimers.slice(0, 100) }
  }

  return { error: `Unknown tool: ${name}` }
}

// ── Helper ────────────────────────────────────────────────────
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── Chat session helpers ──────────────────────────────────────
async function getOrCreateSession(supabase: ReturnType<typeof getSupabaseServer>, sessionId?: string) {
  if (sessionId) {
    const { data } = await supabase.from('chat_sessions').select('id').eq('id', sessionId).single()
    if (data) return sessionId
  }
  const { data } = await supabase.from('chat_sessions').insert({ title: 'New Chat' }).select('id').single()
  return data?.id as string
}

// ── Route handler ─────────────────────────────────────────────
export async function POST(req: Request) {
  // Frontend sends { messages: [{role, content}, ...] }
  const { messages: incomingMessages } = await req.json() as {
    messages: { role: string; content: string }[]
  }

  if (!incomingMessages?.length) {
    return Response.json({ reply: 'No message received.' }, { status: 400 })
  }

  const anthropic = getAnthropic()
  const systemPrompt = await buildSystemPrompt()

  // Convert to Anthropic message format
  const messages: Anthropic.MessageParam[] = incomingMessages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  let finalText = ''

  // Agentic loop
  while (true) {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    })

    for (const block of response.content) {
      if (block.type === 'text') finalText += block.text
    }

    if (response.stop_reason === 'end_turn') break

    if (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter(b => b.type === 'tool_use')
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUses) {
        if (toolUse.type !== 'tool_use') continue
        let result: unknown
        try {
          result = await runTool(toolUse.name, toolUse.input as Record<string, unknown>)
        } catch (err) {
          result = { error: err instanceof Error ? err.message : String(err) }
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        })
      }

      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    break
  }

  return Response.json({ reply: finalText })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const supabase = getSupabaseServer()

  if (action === 'sessions') {
    const { data } = await supabase
      .from('chat_sessions')
      .select('id, title, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20)
    return Response.json({ sessions: data ?? [] })
  }

  if (action === 'history') {
    const sid = searchParams.get('sessionId')
    if (!sid) return Response.json({ messages: [] })
    const { data } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('session_id', sid)
      .order('created_at', { ascending: true })
    return Response.json({ messages: data ?? [] })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}

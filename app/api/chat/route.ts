import Anthropic from '@anthropic-ai/sdk'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: key })
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const PAID_PLANS = new Set(['starter', 'growth', 'intelligence'])

async function checkAndIncrementUsage(churchId: string): Promise<
  { allowed: true; isPaid: boolean } | { allowed: false; limit: number; used: number; resetAt: string }
> {
  const admin = getAdminClient()
  const { data: church } = await admin
    .from('churches')
    .select('plan, plan_status, agent_daily_limit')
    .eq('id', churchId)
    .single()

  if (!church) return { allowed: true, isPaid: false }

  const isPaid = PAID_PLANS.has(church.plan) && church.plan_status === 'active'
  if (isPaid) return { allowed: true, isPaid: true }

  const today = new Date().toISOString().slice(0, 10)
  const limit = church.agent_daily_limit ?? 5

  const { data: usage } = await admin
    .from('agent_daily_usage')
    .select('messages_used')
    .eq('church_id', churchId)
    .eq('usage_date', today)
    .maybeSingle()

  const used = usage?.messages_used ?? 0
  if (used >= limit) {
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    tomorrow.setUTCHours(0, 0, 0, 0)
    return { allowed: false, limit, used, resetAt: tomorrow.toISOString() }
  }

  return { allowed: true, isPaid: false }
}

async function incrementUsage(churchId: string) {
  const admin = getAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data: existing } = await admin
    .from('agent_daily_usage')
    .select('messages_used')
    .eq('church_id', churchId)
    .eq('usage_date', today)
    .maybeSingle()

  if (existing) {
    await admin
      .from('agent_daily_usage')
      .update({ messages_used: existing.messages_used + 1 })
      .eq('church_id', churchId)
      .eq('usage_date', today)
  } else {
    await admin
      .from('agent_daily_usage')
      .insert({ church_id: churchId, usage_date: today, messages_used: 1 })
  }
}

async function getChurchContext() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } },
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: membership } = await supabase
      .from('church_memberships')
      .select('church_id, churches(name, slug)')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership?.church_id) return null

    const churchId = membership.church_id
    const [peopleRes, eventsRes, cellsRes] = await Promise.all([
      supabase.from('people').select('id', { count: 'exact', head: true }).eq('church_id', churchId),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('church_id', churchId),
      supabase.from('cells').select('id', { count: 'exact', head: true }).eq('church_id', churchId).eq('is_active', true),
    ])

    const churches = membership.churches as { name: string } | { name: string }[] | null
    const churchName = (Array.isArray(churches) ? churches[0]?.name : churches?.name) ?? 'your church'

    return {
      supabase,
      churchId,
      churchName,
      totalPeople: peopleRes.count ?? 0,
      totalEvents: eventsRes.count ?? 0,
      totalCells: cellsRes.count ?? 0,
    }
  } catch {
    return null
  }
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_groups',
    description: 'List all ministry groups (e.g. MEGA, YPZ). Each group contains one or more cell groups. Use this to understand church structure or when someone asks about groups.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_cells',
    description: 'List all cell groups. Each cell belongs to a group. Returns name, group, leader, meeting schedule, and location.',
    input_schema: {
      type: 'object',
      properties: {
        group_name: { type: 'string', description: 'Filter cells by group name or partial name (e.g. "MEGA"). Omit for all cells.' },
      },
    },
  },
  {
    name: 'search_people',
    description: 'Search church members by name. Returns contact info, cell group, group, designation, pastor, gender, marital status.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'First name, last name, or full name to search for' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_events_by_date',
    description: 'Get all church events (services, cell meetings, outreach, etc.) within a date range — past or future. Use for questions like "what happened the week of May 17th".',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date YYYY-MM-DD (required)' },
        end_date: { type: 'string', description: 'End date YYYY-MM-DD (required)' },
        group_name: { type: 'string', description: 'Filter by group name (optional)' },
        service_type: { type: 'string', description: 'Filter by type: cell, service, outreach, other (optional)' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_cell_attendance',
    description: 'Get who attended a specific cell group meeting on a specific date, or list recent meetings for a cell.',
    input_schema: {
      type: 'object',
      properties: {
        cell_name: { type: 'string', description: 'Cell group name or partial name (e.g. "RIT")' },
        date: { type: 'string', description: 'Specific date YYYY-MM-DD. Omit to get the most recent meetings.' },
      },
      required: ['cell_name'],
    },
  },
  {
    name: 'get_event_attendance',
    description: 'Get attendance for any event (service, outreach, etc.) by event name and/or date.',
    input_schema: {
      type: 'object',
      properties: {
        event_name: { type: 'string', description: 'Event name or partial name' },
        date: { type: 'string', description: 'Date YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'get_giving_summary',
    description: 'Get giving/donation records. Filter by person name and/or date range.',
    input_schema: {
      type: 'object',
      properties: {
        person_name: { type: 'string', description: 'Person name or partial name (optional)' },
        start_date: { type: 'string', description: 'Start date YYYY-MM-DD (default: 90 days ago)' },
        end_date: { type: 'string', description: 'End date YYYY-MM-DD (default: today)' },
      },
    },
  },
  {
    name: 'get_follow_ups',
    description: 'Get pastoral follow-up records for first-time visitors and people who need follow-up.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status: pending, sent, or dismissed. Omit for all.' },
      },
    },
  },
  {
    name: 'get_attendance_trends',
    description: 'Week-by-week attendance trends. Useful for spotting growth or decline patterns.',
    input_schema: {
      type: 'object',
      properties: {
        weeks: { type: 'number', description: 'Number of past weeks to analyze (default 12)' },
        service_type: { type: 'string', description: 'Filter by type: cell, service, outreach' },
      },
    },
  },
]

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  churchId: string,
  supabase: SupabaseClient,
): Promise<string> {
  try {
    switch (name) {
      case 'get_groups': {
        const { data, error } = await supabase
          .from('groups')
          .select('id, name, cells(name, leader_name, meeting_day, meeting_time, is_active)')
          .eq('church_id', churchId)
          .order('name')
        if (error) return `Error: ${error.message}`
        if (!data?.length) return 'No groups found.'
        const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const result = data.map(g => ({
          group: g.name,
          cells: (g.cells as Array<{ name: string; leader_name: string | null; meeting_day: number | null; meeting_time: string | null; is_active: boolean }>).map(c => ({
            name: c.name,
            leader: c.leader_name,
            meets: c.meeting_day != null ? DAY[c.meeting_day] : null,
            time: c.meeting_time,
            active: c.is_active,
          })),
        }))
        return JSON.stringify(result)
      }

      case 'get_events_by_date': {
        const startDate = String(input.start_date ?? '')
        const endDate = String(input.end_date ?? '')
        const groupName = input.group_name ? String(input.group_name) : null
        const serviceType = input.service_type ? String(input.service_type) : null

        let q = supabase
          .from('events')
          .select('name, event_date, event_datetime, service_type, location, cells(name, groups(name)), groups(name)')
          .eq('church_id', churchId)
          .gte('event_date', startDate)
          .lte('event_date', endDate)
          .order('event_date', { ascending: true })
          .limit(50)

        if (serviceType) q = q.eq('service_type', serviceType)

        const { data, error } = await q
        if (error) return `Error: ${error.message}`
        if (!data?.length) return `No events found between ${startDate} and ${endDate}.`

        // Filter by group name if provided (post-fetch since nested filter isn't easily done via PostgREST)
        const rows = data.map(e => {
          const cell = e.cells as unknown as { name: string; groups: { name: string } | null } | null
          const group = e.groups as unknown as { name: string } | null
          return {
            name: e.name,
            date: e.event_date,
            type: e.service_type,
            location: e.location,
            cell: cell?.name ?? null,
            group: cell?.groups?.name ?? group?.name ?? null,
          }
        }).filter(e => !groupName || (e.group ?? '').toLowerCase().includes(groupName.toLowerCase()))

        if (!rows.length) return `No events found${groupName ? ` in group "${groupName}"` : ''} between ${startDate} and ${endDate}.`
        return JSON.stringify(rows)
      }

      case 'search_people': {
        const q = String(input.query ?? '')
        const { data, error } = await supabase
          .from('people')
          .select('first_name, last_name, email, phone, cell_name, group_name, pastor, designation, gender, marital_status, baptized, joined_oasis')
          .eq('church_id', churchId)
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
          .limit(10)
        if (error) return `Error searching people: ${error.message}`
        if (!data?.length) return `No members found matching "${q}".`
        return JSON.stringify(data)
      }

      case 'get_cell_attendance': {
        const cellName = String(input.cell_name ?? '')
        const date = input.date ? String(input.date) : null

        const { data: cells } = await supabase
          .from('cells')
          .select('id, name')
          .eq('church_id', churchId)
          .ilike('name', `%${cellName}%`)
          .limit(1)

        if (!cells?.length) return `No cell group found matching "${cellName}".`
        const cell = cells[0]

        let eventsQuery = supabase
          .from('events')
          .select('id, name, event_date')
          .eq('church_id', churchId)
          .eq('cell_id', cell.id)
          .order('event_date', { ascending: false })
          .limit(date ? 1 : 5)

        if (date) eventsQuery = eventsQuery.eq('event_date', date)

        const { data: events } = await eventsQuery
        if (!events?.length) {
          return `No meetings found for ${cell.name}${date ? ` on ${date}` : ''}.`
        }

        const results = await Promise.all(events.map(async (event) => {
          const { data: rows } = await supabase
            .from('attendance')
            .select('attendance_status, people(first_name, last_name)')
            .eq('event_id', event.id)
          const attendees = (rows ?? []).map(r => {
            const p = r.people as unknown as { first_name: string; last_name: string } | null
            return p ? `${p.first_name} ${p.last_name}` : 'Unknown'
          })
          return { cell: cell.name, event: event.name, date: event.event_date, count: attendees.length, attendees }
        }))

        return JSON.stringify(results)
      }

      case 'get_event_attendance': {
        const eventName = input.event_name ? String(input.event_name) : null
        const date = input.date ? String(input.date) : null

        let q = supabase
          .from('events')
          .select('id, name, event_date, service_type, first_timers, soul_won')
          .eq('church_id', churchId)
          .order('event_date', { ascending: false })
          .limit(5)

        if (eventName) q = q.ilike('name', `%${eventName}%`)
        if (date) q = q.eq('event_date', date)

        const { data: events } = await q
        if (!events?.length) return `No events found${eventName ? ` matching "${eventName}"` : ''}${date ? ` on ${date}` : ''}.`

        const results = await Promise.all(events.map(async (event) => {
          const { data: rows } = await supabase
            .from('attendance')
            .select('people(first_name, last_name)')
            .eq('event_id', event.id)
          const attendees = (rows ?? []).map(r => {
            const p = r.people as unknown as { first_name: string; last_name: string } | null
            return p ? `${p.first_name} ${p.last_name}` : 'Unknown'
          })
          return { event: event.name, date: event.event_date, type: event.service_type, count: attendees.length, first_timers: event.first_timers, soul_won: event.soul_won, attendees }
        }))

        return JSON.stringify(results)
      }

      case 'get_giving_summary': {
        const personName = input.person_name ? String(input.person_name) : null
        const startDate = input.start_date ? String(input.start_date) : null
        const endDate = input.end_date ? String(input.end_date) : null

        let q = supabase
          .from('giving')
          .select('person_name, amount, fund, method, given_at, notes')
          .eq('church_id', churchId)
          .order('given_at', { ascending: false })
          .limit(50)

        if (personName) q = q.ilike('person_name', `%${personName}%`)
        if (startDate) q = q.gte('given_at', startDate)
        if (endDate) q = q.lte('given_at', endDate)

        const { data, error } = await q
        if (error) return `Error: ${error.message}`
        if (!data?.length) return `No giving records found${personName ? ` for "${personName}"` : ''}.`

        const total = data.reduce((sum, r) => sum + Number(r.amount), 0)
        return JSON.stringify({ total: total.toFixed(2), count: data.length, records: data })
      }

      case 'get_upcoming_events': {
        const daysAhead = Number(input.days_ahead ?? 30)
        const serviceType = input.service_type ? String(input.service_type) : null
        const until = new Date()
        until.setDate(until.getDate() + daysAhead)

        let q = supabase
          .from('events')
          .select('name, event_date, event_datetime, service_type, location, description, cells(name), groups(name)')
          .eq('church_id', churchId)
          .gte('event_date', new Date().toISOString().slice(0, 10))
          .lte('event_date', until.toISOString().slice(0, 10))
          .order('event_date', { ascending: true })
          .limit(20)

        if (serviceType) q = q.eq('service_type', serviceType)

        const { data, error } = await q
        if (error) return `Error: ${error.message}`
        if (!data?.length) return `No upcoming events in the next ${daysAhead} days.`
        return JSON.stringify(data)
      }

      case 'get_follow_ups': {
        const status = input.status ? String(input.status) : null

        let q = supabase
          .from('follow_ups')
          .select('person_name, phone, event_name, event_date, message, status, created_at')
          .eq('church_id', churchId)
          .order('event_date', { ascending: false })
          .limit(30)

        if (status) q = q.eq('status', status)

        const { data, error } = await q
        if (error) return `Error: ${error.message}`
        if (!data?.length) return `No follow-up records found${status ? ` with status "${status}"` : ''}.`
        return JSON.stringify(data)
      }

      case 'get_cells': {
        const groupName = input.group_name ? String(input.group_name) : null

        let q = supabase
          .from('cells')
          .select('name, leader_name, location, meeting_day, meeting_time, is_active, groups(name)')
          .eq('church_id', churchId)
          .order('name')

        const { data: cells, error } = await q
        if (error) return `Error: ${error.message}`
        if (!cells?.length) return 'No cell groups found.'

        const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        let result = cells.map(c => {
          const grp = c.groups as unknown as { name: string } | null
          return {
            name: c.name,
            group: grp?.name ?? null,
            leader: c.leader_name,
            location: c.location,
            meets: c.meeting_day != null ? DAY[c.meeting_day] : null,
            time: c.meeting_time,
            active: c.is_active,
          }
        })

        if (groupName) {
          result = result.filter(c => (c.group ?? '').toLowerCase().includes(groupName.toLowerCase()))
          if (!result.length) return `No cells found in group "${groupName}".`
        }

        return JSON.stringify(result)
      }

      case 'get_attendance_trends': {
        const weeks = Number(input.weeks ?? 12)
        const serviceType = input.service_type ? String(input.service_type) : null
        const since = new Date()
        since.setDate(since.getDate() - weeks * 7)

        let q = supabase
          .from('events')
          .select('id, name, event_date, service_type, attendance(id)')
          .eq('church_id', churchId)
          .gte('event_date', since.toISOString().slice(0, 10))
          .order('event_date', { ascending: false })

        if (serviceType) q = q.eq('service_type', serviceType)

        const { data, error } = await q
        if (error) return `Error: ${error.message}`
        if (!data?.length) return `No events in the past ${weeks} weeks.`

        const rows = data.map(e => ({
          name: e.name,
          date: e.event_date,
          type: e.service_type,
          attendance: Array.isArray(e.attendance) ? e.attendance.length : 0,
        }))
        return JSON.stringify(rows)
      }

      default:
        return `Unknown tool: ${name}`
    }
  } catch (err) {
    return `Tool error: ${err instanceof Error ? err.message : String(err)}`
  }
}

const BASE_SYSTEM = `You are Oasis Assistant — a knowledgeable, warm AI helper embedded inside Aquila, a church management platform used by Oasis PFCC. You help church administrators, pastors, and leaders understand their congregation, plan events, and make data-driven ministry decisions.

Church data structure:
- Groups (e.g. MEGA, YPZ) are ministry groupings that contain one or more cell groups.
- Cells are the individual small groups/cell meetings that belong to a group.
- Events are any scheduled meeting — services, outreach, or cell meetings — each event can be linked to a cell and/or group.
- People are members, each with an optional cell_name and group_name field.

You have access to live church data through tools. When someone asks about attendance, members, giving, events, cells, groups, or follow-ups — use the appropriate tool to look it up immediately. Never say you don't have access to data. Never ask for clarification if you can just run the tool with reasonable assumptions.

For date questions like "the week of May 17th", use get_events_by_date with start_date=2026-05-17 and end_date=2026-05-23.
For group questions, use get_groups first to understand the structure.

Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

Be concise, warm, and pastoral. Give real answers from the data. Use plain text, no markdown headers. Keep responses focused and actionable.`

export async function POST(req: Request) {
  try {
    const { messages } = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[]
    }

    if (!messages?.length) {
      return Response.json({ error: 'No messages provided' }, { status: 400 })
    }

    const ctx = await getChurchContext()

    // Freemium gate
    let isPaidPlan = false
    if (ctx) {
      const check = await checkAndIncrementUsage(ctx.churchId)
      if (!check.allowed) {
        return Response.json(
          { error: 'daily_limit_reached', limit: check.limit, used: check.used, resetAt: check.resetAt },
          { status: 429 },
        )
      }
      isPaidPlan = check.isPaid
    }

    const systemPrompt = ctx
      ? `${BASE_SYSTEM}\n\nChurch: ${ctx.churchName}\nMembers in system: ${ctx.totalPeople}\nTotal events recorded: ${ctx.totalEvents}\nActive cell groups: ${ctx.totalCells}`
      : BASE_SYSTEM

    const anthropic = getAnthropic()
    const tools = ctx ? TOOLS : []

    let msgs: Anthropic.MessageParam[] = messages.map(m => ({ role: m.role, content: m.content }))

    let response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: msgs,
    })

    // Agentic loop: execute tools until Claude is done
    let iterations = 0
    while (response.stop_reason === 'tool_use' && iterations < 5) {
      iterations++
      const toolBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolBlocks.map(async (block) => ({
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            ctx!.churchId,
            ctx!.supabase,
          ),
        })),
      )

      msgs = [...msgs, { role: 'assistant', content: response.content }, { role: 'user', content: toolResults }]

      response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages: msgs,
      })
    }

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    const reply = textBlock?.text ?? 'Sorry, I could not generate a response.'

    // Track usage for free tier (fire-and-forget — don't block the response)
    if (ctx && !isPaidPlan) incrementUsage(ctx.churchId).catch(() => {})

    return Response.json({ reply })
  } catch (err) {
    console.error('[chat]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

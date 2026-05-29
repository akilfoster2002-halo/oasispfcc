import Anthropic from '@anthropic-ai/sdk'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

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
  const limit = church.agent_daily_limit ?? 10

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

/* ─── SQL safety guard — read-only SELECT / WITH only ─── */
function isSafeQuery(sql: string): boolean {
  const normalized = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '').trim().toUpperCase()
  if (!/^(SELECT|WITH)\b/.test(normalized)) return false
  const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE|CALL|DO|COPY)\b/
  return !forbidden.test(normalized)
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'run_sql',
    description: `Execute a read-only SQL SELECT query against the church database to answer any question about members, attendance, cells, groups, events, giving, or follow-ups. Always filter by church_id = '<churchId>' (will be provided). Return only what is needed — use LIMIT to avoid huge result sets. Never use INSERT, UPDATE, DELETE or any mutating statement.`,
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'A valid PostgreSQL SELECT (or WITH ... SELECT) statement. Always include WHERE church_id = \'<churchId>\' (substitute the real church ID). Use JOINs across tables as needed.',
        },
        description: {
          type: 'string',
          description: 'One sentence explaining what this query fetches, for display to the user.',
        },
      },
      required: ['query', 'description'],
    },
  },
]

const SCHEMA = `
Database schema (PostgreSQL via Supabase):

people — church members
  id uuid, church_id uuid, first_name text, last_name text, email text, phone text,
  gender text, birthdate date, group_name text, pastor text, designation text,
  cell_name text, fellowship text, who_invited text, joined_oasis text,
  baptized text, marital_status text, profession text, school text, major text

events — any scheduled meeting
  id uuid, church_id uuid, name text, service_type text, event_date date,
  group_id uuid, cell_id uuid (null for services), series_id uuid,
  first_timers int, soul_won int, location text
  service_type values: 'sunday_inperson' | 'sunday_online' | 'midweek' | 'cell_meeting' | 'other'
  → cell meetings have cell_id set; services have cell_id IS NULL

attendance — who attended each event
  id uuid, church_id uuid, person_id uuid, event_id uuid,
  attendance_status text ('present' | 'absent')

cells — small groups
  id uuid, church_id uuid, name text, leader_name text, group_id uuid,
  meeting_day smallint (0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat),
  meeting_time text, location text, is_active boolean

groups — ministry groupings that contain cells (e.g. MEGA, YPZ)
  id uuid, church_id uuid, name text

giving — donation records
  id uuid, church_id uuid, person_id uuid, person_name text,
  amount numeric, fund text, method text, given_at date

follow_ups — first-timer and pastoral follow-up tasks
  id uuid, church_id uuid, person_id uuid, person_name text,
  phone text, event_name text, event_date date, message text,
  status text ('pending' | 'sent' | 'dismissed')

conversations — SMS/messaging threads
  id uuid, church_id uuid, person_id uuid, phone text, name text,
  status text, assigned_leader text

Key relationships:
  attendance.person_id → people.id
  attendance.event_id  → events.id
  events.cell_id       → cells.id
  events.group_id      → groups.id
  cells.group_id       → groups.id
  people.cell_name     = cells.name (denormalized text, not a FK)
  people.group_name    = groups.name (denormalized text, not a FK)
`

const BASE_SYSTEM = `You are Aquila Agent — a knowledgeable, warm AI assistant embedded inside Aquila, a church management platform used by pastors and church administrators.

You have access to the church's live database through a single SQL tool. When someone asks about attendance, members, cells, giving, events, follow-ups, or anything data-related — write a SQL query to look it up immediately. Never say you don't have access to data. Be confident and direct.

${SCHEMA}

Rules for writing queries:
- Always filter WHERE church_id = '<CHURCH_ID>' (use the actual church ID provided below)
- Cell meetings: events WHERE cell_id IS NOT NULL
- Sunday/midweek services: events WHERE cell_id IS NULL AND service_type IN ('sunday_inperson','sunday_online','midweek')
- To find people who attended a service: JOIN attendance ON attendance.event_id = events.id AND attendance.person_id = people.id
- To find last cell attended: SELECT DISTINCT ON (person_id) with ORDER BY event_date DESC
- Use LIMIT (max 200 rows) unless a full count is needed
- For counts, use COUNT(*) — don't fetch all rows
- Use COALESCE(cell_name, 'No Cell') when grouping people by cell

CRITICAL — accuracy and trust:
- Never make absolute statements like "never attended" or "always present" without running a query that proves it with actual rows
- If you say someone has never attended a type of event, you must have queried for that event type specifically and confirmed 0 rows — not inferred it from a different query
- When a person's name is ambiguous (common first name), always clarify which person you found by stating their full name and cell/group before giving the answer
- Do not add analysis, recommendations, or emotional framing on top of data you are not certain about
- If a query returns 0 rows, say so plainly and suggest the user verify the person's name rather than concluding the data is complete
- Run a second verification query if your first result seems surprising

CRITICAL — how groups and cells work:
- "MEGA", "YPZ", "HOM" etc. are ministry groups. A person belongs to a group via people.group_name (e.g. WHERE people.group_name ILIKE '%MEGA%')
- Do NOT use events.group_id to find members of a group — that only finds events tagged to that group, not the people in it
- To find all people in MEGA: WHERE people.group_name ILIKE '%MEGA%'
- Attendance for group members includes ALL services they attended (Sunday, midweek, cell) — not just events tagged to their group
- "Who fell off" or "who hasn't been seen" = people with high historical attendance whose MAX(event_date) is far in the past
- Always count ALL attendance records for a person (across all event types) when assessing engagement
- Never return "no results" without verifying the query actually reached the people table filtered by group_name

Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

Format responses using markdown:
- Use **bold** for numbers and key highlights
- When listing specific people, ALWAYS format their name as a markdown link using their UUID: [First Last](person:UUID) — always SELECT the id column when querying individuals so you can include it
- Use numbered or bulleted lists when presenting multiple people or items
- Use headings (##) sparingly — only for multi-section responses
- Keep responses concise, warm, and pastoral
- Give real answers from the data — specific names, numbers, dates
- Never say you don't have access to the data`

export async function POST(req: Request) {
  try {
    const { messages } = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[]
    }

    if (!messages?.length) {
      return Response.json({ error: 'No messages provided' }, { status: 400 })
    }

    const ctx = await getChurchContext()

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
      ? BASE_SYSTEM
          .replace('<CHURCH_ID>', ctx.churchId)
          .replace("filter WHERE church_id = '<CHURCH_ID>'", `filter WHERE church_id = '${ctx.churchId}'`) +
        `\n\nChurch: ${ctx.churchName} (ID: ${ctx.churchId})\nMembers in system: ${ctx.totalPeople}\nTotal events recorded: ${ctx.totalEvents}\nActive cell groups: ${ctx.totalCells}`
      : BASE_SYSTEM

    const anthropic = getAnthropic()
    const tools = ctx ? TOOLS : []
    const admin = ctx ? getAdminClient() : null

    let msgs: Anthropic.MessageParam[] = messages.map(m => ({ role: m.role, content: m.content }))

    let response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages: msgs,
    })

    let iterations = 0
    while (response.stop_reason === 'tool_use' && iterations < 8) {
      iterations++
      const toolBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolBlocks.map(async (block) => {
          if (block.name !== 'run_sql' || !admin) {
            return { type: 'tool_result' as const, tool_use_id: block.id, content: 'Tool unavailable.' }
          }

          const { query } = block.input as { query: string; description: string }

          if (!isSafeQuery(query)) {
            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: 'Error: only SELECT queries are permitted.',
            }
          }

          try {
            const { data, error } = await admin.rpc('execute_readonly_sql', { sql: query }).single()

            // Fallback: use raw postgres if RPC not available
            if (error?.message?.includes('execute_readonly_sql')) {
              // Direct query via PostgREST isn't possible for arbitrary SQL, return the error
              return {
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: `Query error: ${error.message}. Try a simpler query or use the table-based approach.`,
              }
            }

            if (error) {
              return { type: 'tool_result' as const, tool_use_id: block.id, content: `Query error: ${error.message}` }
            }

            const result = JSON.stringify(data ?? [])
            // Truncate very large results
            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: result.length > 12000 ? result.slice(0, 12000) + '\n[...truncated]' : result,
            }
          } catch (err) {
            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
            }
          }
        }),
      )

      msgs = [...msgs, { role: 'assistant', content: response.content }, { role: 'user', content: toolResults }]

      response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: systemPrompt,
        tools,
        messages: msgs,
      })
    }

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    const reply = textBlock?.text ?? 'Sorry, I could not generate a response.'

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

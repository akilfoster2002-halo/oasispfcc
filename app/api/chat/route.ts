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
    name: 'find_person',
    description: `Find church members by name. Always call this first when a question is about a specific person. Returns all matches with id, full name, cell, group, and phone. If multiple people match, ask the user to clarify before proceeding.`,
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name or partial name to search (first, last, or both).' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_member_profile',
    description: `Get the complete profile for one person: all attendance history (every service and cell meeting), giving summary, follow-up history, and their profile fields. Use this when you need a full picture of someone — engagement level, patterns, last seen, giving, pastoral notes. Never guess at someone's history — call this tool.`,
    input_schema: {
      type: 'object',
      properties: {
        person_id: { type: 'string', description: 'UUID of the person (from find_person).' },
      },
      required: ['person_id'],
    },
  },
  {
    name: 'get_church_snapshot',
    description: `Get a real-time snapshot of the whole church: recent service attendance trends (last 8 weeks), cell health overview, pending follow-ups count, at-risk member count (missing 3+ weeks of cell), and top-line giving. Call this first when answering big-picture questions about the church's health, growth, or overall engagement. Gives you the context you need before diving into specifics.`,
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'run_sql',
    description: `Execute a read-only SQL SELECT for aggregate or analytical questions — trends, comparisons, ranked lists, custom criteria. Do NOT use for individual person attendance (use get_member_profile) or church-wide health (use get_church_snapshot). Always filter by church_id. No mutations.`,
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'PostgreSQL SELECT or WITH...SELECT statement.' },
        description: { type: 'string', description: 'One sentence explaining what this fetches.' },
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

You have access to the church's live database through purpose-built tools and SQL. When someone asks about attendance, members, cells, giving, events, follow-ups, or anything data-related — use the right tool immediately. Never say you don't have access to data. Be confident and direct.

CRITICAL — conversation context:
- You have the full conversation history. Read it before every response.
- If a person was already looked up in this conversation, do not search for them again — use the information already retrieved.
- If something was already established (e.g. "Adriana Santiago is not in the system"), acknowledge it directly instead of repeating the same search.
- When a user says "pull her up", "show me", "what about X" — they are referring to the current conversation context. Look at what was just discussed.
- Remember what names, cells, and facts have been mentioned. Build on them rather than starting fresh each turn.
- If the user gives you a list of names to check (like a roster), work through them systematically and keep track of who you've already found vs not found.

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

/* ─── Tool labels shown to the user during execution ─── */
const TOOL_LABEL: Record<string, (input: Record<string, unknown>) => string> = {
  find_person:        (i) => `Looking up ${(i as { name: string }).name}…`,
  get_member_profile: ()  => `Pulling up full profile…`,
  get_church_snapshot: ()  => `Reading church health…`,
  run_sql:            (i) => (i as { description?: string }).description ?? 'Running query…',
}

/* ─── Execute a single tool call and return the result ─── */
async function executeTool(
  block:   Anthropic.ToolUseBlock,
  admin:   ReturnType<typeof getAdminClient> | null,
  ctx:     Awaited<ReturnType<typeof getChurchContext>>,
): Promise<string> {
  if (!admin || !ctx) return 'Tool unavailable.'

  // ── find_person ───────────────────────────────────────────────────────
  if (block.name === 'find_person') {
    const { name } = block.input as { name: string }
    const terms = name.trim().split(/\s+/)
    let q = admin.from('people').select('id, first_name, last_name, cell_name, group_name, phone').eq('church_id', ctx.churchId)
    if (terms.length === 1) {
      q = q.or(`first_name.ilike.%${terms[0]}%,last_name.ilike.%${terms[0]}%`)
    } else {
      q = q.or(`and(first_name.ilike.%${terms[0]}%,last_name.ilike.%${terms[1]}%),and(first_name.ilike.%${terms[1]}%,last_name.ilike.%${terms[0]}%)`)
    }
    const { data, error } = await q.limit(10)
    if (error) return `Error: ${error.message}`
    if (!data?.length) return `No one found matching "${name}". Try a different spelling or use just the first name.`
    return JSON.stringify(data)
  }

  // ── get_member_profile ───────────────────────────────────────────────
  if (block.name === 'get_member_profile') {
    const { person_id } = block.input as { person_id: string }
    const cid = ctx.churchId
    const [profileRes, attRes, givingRes, fuRes] = await Promise.all([
      admin.from('people').select('*').eq('id', person_id).single(),
      admin.rpc('execute_readonly_sql', { sql: `
        SELECT e.name AS event_name, e.event_date, e.service_type,
          CASE WHEN e.cell_id IS NULL THEN 'service' ELSE 'cell_meeting' END AS event_kind
        FROM attendance a JOIN events e ON e.id = a.event_id
        WHERE a.person_id = '${person_id}' AND a.church_id = '${cid}' AND a.attendance_status = 'present'
        ORDER BY e.event_date DESC LIMIT 200
      ` }).single(),
      admin.from('giving').select('amount, fund, given_at, method').eq('person_id', person_id).eq('church_id', cid).order('given_at', { ascending: false }).limit(20),
      admin.from('follow_ups').select('status, event_name, event_date, message').eq('person_id', person_id).eq('church_id', cid).limit(10),
    ])
    const att = (attRes.data ?? []) as { event_kind: string; event_date: string }[]
    return JSON.stringify({
      profile:    profileRes.data,
      attendance: { total: att.length, services: att.filter(e => e.event_kind === 'service').length, cell_meetings: att.filter(e => e.event_kind === 'cell_meeting').length, last_seen: att[0]?.event_date ?? null, history: att.slice(0, 50) },
      giving:     givingRes.data ?? [],
      follow_ups: fuRes.data ?? [],
    })
  }

  // ── get_church_snapshot ───────────────────────────────────────────────
  if (block.name === 'get_church_snapshot') {
    const cid = ctx.churchId
    const [svcRes, cellRes, fuRes, riskRes, giveRes] = await Promise.all([
      admin.rpc('execute_readonly_sql', { sql: `SELECT e.name, e.event_date, e.service_type, COUNT(a.id) FILTER (WHERE a.attendance_status='present') AS present_count FROM events e LEFT JOIN attendance a ON a.event_id=e.id AND a.church_id='${cid}' WHERE e.church_id='${cid}' AND e.cell_id IS NULL AND e.event_date >= NOW()-INTERVAL '8 weeks' GROUP BY e.id ORDER BY e.event_date DESC LIMIT 16` }).single(),
      admin.rpc('execute_readonly_sql', { sql: `SELECT c.name, c.leader_name, COUNT(a.id) FILTER (WHERE a.attendance_status='present') AS recent_attendance FROM cells c LEFT JOIN events e ON e.cell_id=c.id AND e.event_date>=NOW()-INTERVAL '6 weeks' LEFT JOIN attendance a ON a.event_id=e.id AND a.church_id='${cid}' WHERE c.church_id='${cid}' AND c.is_active=true GROUP BY c.id ORDER BY recent_attendance DESC LIMIT 20` }).single(),
      admin.from('follow_ups').select('id', { count: 'exact', head: true }).eq('church_id', cid).eq('status', 'pending'),
      admin.rpc('execute_readonly_sql', { sql: `SELECT COUNT(DISTINCT a.person_id) AS at_risk FROM attendance a JOIN events e ON e.id=a.event_id WHERE a.church_id='${cid}' AND e.cell_id IS NOT NULL AND a.attendance_status='present' AND a.person_id NOT IN (SELECT DISTINCT person_id FROM attendance aa JOIN events ee ON ee.id=aa.event_id WHERE aa.church_id='${cid}' AND ee.cell_id IS NOT NULL AND aa.attendance_status='present' AND ee.event_date>=NOW()-INTERVAL '21 days')` }).single(),
      admin.rpc('execute_readonly_sql', { sql: `SELECT SUM(amount) AS total, COUNT(*) AS gifts FROM giving WHERE church_id='${cid}' AND given_at>=NOW()-INTERVAL '30 days'` }).single(),
    ])
    return JSON.stringify({ recent_services: svcRes.data, cell_health: cellRes.data, pending_follow_ups: fuRes.count ?? 0, at_risk_members: (riskRes.data as unknown as { at_risk: number }[])?.[0]?.at_risk ?? 0, giving_last_30_days: giveRes.data })
  }

  // ── run_sql ───────────────────────────────────────────────────────────
  if (block.name === 'run_sql') {
    const { query } = block.input as { query: string }
    if (!isSafeQuery(query)) return 'Error: only SELECT queries are permitted.'
    try {
      const { data, error } = await admin.rpc('execute_readonly_sql', { sql: query }).single()
      if (error) return `Query error: ${error.message}`
      const result = JSON.stringify(data ?? [])
      return result.length > 12000 ? result.slice(0, 12000) + '\n[...truncated]' : result
    } catch (err) {
      return `Unexpected error: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  return 'Unknown tool.'
}

/* ─── Main POST handler — SSE streaming with extended thinking ─── */
export async function POST(req: Request) {
  try {
    const { messages } = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[]
    }
    if (!messages?.length) return Response.json({ error: 'No messages provided' }, { status: 400 })

    const ctx = await getChurchContext()

    if (ctx) {
      const check = await checkAndIncrementUsage(ctx.churchId)
      if (!check.allowed) {
        return Response.json(
          { error: 'daily_limit_reached', limit: check.limit, used: check.used, resetAt: check.resetAt },
          { status: 429 },
        )
      }
      if (check.isPaid === false) {
        // fire-and-forget increment for free plans
        incrementUsage(ctx.churchId).catch(() => {})
      }
    }

    const systemPrompt = ctx
      ? BASE_SYSTEM
          .replace('<CHURCH_ID>', ctx.churchId)
          .replace("filter WHERE church_id = '<CHURCH_ID>'", `filter WHERE church_id = '${ctx.churchId}'`) +
        `\n\nChurch: ${ctx.churchName} (ID: ${ctx.churchId})\nMembers in system: ${ctx.totalPeople}\nTotal events recorded: ${ctx.totalEvents}\nActive cell groups: ${ctx.totalCells}`
      : BASE_SYSTEM

    const anthropic = getAnthropic()
    const tools    = ctx ? TOOLS : []
    const admin    = ctx ? getAdminClient() : null
    const encoder  = new TextEncoder()

    let msgs: Anthropic.MessageParam[] = messages.map(m => ({ role: m.role, content: m.content }))

    const sseStream = new ReadableStream({
      async start(controller) {
        function send(event: string, data: unknown) {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        }

        try {
          let iterations = 0

          while (iterations < 15) {
            // Stream this turn — extended thinking reasons before responding
            const apiStream = anthropic.messages.stream({
              model:      'claude-sonnet-4-6',
              max_tokens: 16000,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              thinking:   { type: 'enabled', budget_tokens: 10000 } as any,
              system:     systemPrompt,
              tools:      tools as Anthropic.Tool[],
              messages:   msgs,
            })

            // Send text deltas to the client as they arrive
            // (thinking deltas are not emitted by .on('text'))
            apiStream.on('text', (delta) => send('text', { delta }))

            const finalMsg = await apiStream.finalMessage()

            if (finalMsg.stop_reason !== 'tool_use') break

            // ── Tool calls ─────────────────────────────────────────────
            const toolBlocks = finalMsg.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
            )

            // Notify the client what we're doing
            for (const block of toolBlocks) {
              const label = TOOL_LABEL[block.name]?.(block.input as Record<string, unknown>) ?? `${block.name}…`
              send('tool', { label })
            }

            // Execute all tools (preserve thinking blocks in history)
            const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
              toolBlocks.map(async (block) => ({
                type:        'tool_result' as const,
                tool_use_id: block.id,
                content:     await executeTool(block, admin, ctx),
              })),
            )

            msgs = [
              ...msgs,
              { role: 'assistant', content: finalMsg.content },
              { role: 'user',      content: toolResults },
            ]

            iterations++
          }

          send('done', {})
          controller.close()
        } catch (err) {
          console.error('[chat stream]', err)
          send('error', { message: err instanceof Error ? err.message : 'Unknown error' })
          controller.close()
        }
      },
    })

    return new Response(sseStream, {
      headers: {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection':    'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    console.error('[chat]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

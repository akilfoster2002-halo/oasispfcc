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

/* Escape single quotes for safe interpolation into SQL string literals */
function esc(s: string): string {
  return String(s).replace(/'/g, "''")
}

/* Clamp an integer input to a safe range */
function clampInt(val: unknown, min: number, max: number, def: number): number {
  const n = parseInt(String(val ?? def), 10)
  return isNaN(n) ? def : Math.min(Math.max(n, min), max)
}

/* ─── Tool definitions ─── */
const TOOLS: Anthropic.Tool[] = [
  // ── Individual lookups ────────────────────────────────────────────────
  {
    name: 'find_person',
    description: `Find church members by name. Call this first when a question names a specific person. Returns id, full name, cell, group, and phone. If multiple matches, ask the user to clarify.`,
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'First name, last name, or both.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_member_profile',
    description: `Full profile for one person: all attendance history (services + cell meetings), giving, follow-ups, and profile fields. Use when you need a deep picture of an individual — engagement level, last seen, patterns, giving, pastoral notes.`,
    input_schema: {
      type: 'object',
      properties: {
        person_id: { type: 'string', description: 'UUID from find_person.' },
      },
      required: ['person_id'],
    },
  },

  // ── Cell deep-dive tools ──────────────────────────────────────────────
  {
    name: 'get_cell_deep_dive',
    description: `The primary cell analysis tool. Returns every member of a cell with: cell meetings attended (90d), services attended (90d), last cell date, last service date, last seen overall, and a trend flag (improving / steady / declining / gone_quiet / inactive). Use this first for any question about a cell's health or its people.`,
    input_schema: {
      type: 'object',
      properties: {
        cell_name: { type: 'string', description: 'Cell name or partial name.' },
      },
      required: ['cell_name'],
    },
  },
  {
    name: 'get_cell_only_members',
    description: `Members of a cell who attended cell meetings but did NOT attend any Sunday or midweek service in the last N weeks. Useful for identifying people who are engaged in the cell but disconnected from main services.`,
    input_schema: {
      type: 'object',
      properties: {
        cell_name: { type: 'string', description: 'Cell name or partial name.' },
        weeks: { type: 'number', description: 'Lookback window in weeks (default 4).' },
      },
      required: ['cell_name'],
    },
  },
  {
    name: 'get_midweek_only_members',
    description: `Members of a cell who attended Sunday or midweek services but did NOT attend their cell meeting in the last N weeks. Identifies people showing up to big services but skipping the cell.`,
    input_schema: {
      type: 'object',
      properties: {
        cell_name: { type: 'string', description: 'Cell name or partial name.' },
        weeks: { type: 'number', description: 'Lookback window in weeks (default 4).' },
      },
      required: ['cell_name'],
    },
  },
  {
    name: 'get_absent_from_both',
    description: `Members of a cell who have not attended ANY event — neither cell meetings nor services — in the last N weeks. These are the people who have gone completely quiet.`,
    input_schema: {
      type: 'object',
      properties: {
        cell_name: { type: 'string', description: 'Cell name or partial name.' },
        weeks: { type: 'number', description: 'Lookback window in weeks (default 4).' },
      },
      required: ['cell_name'],
    },
  },
  {
    name: 'get_cell_attendance_trend',
    description: `Week-by-week headcount for a specific cell's meetings — how many attended each session over the last N meetings. Shows whether the cell is growing, shrinking, or flat.`,
    input_schema: {
      type: 'object',
      properties: {
        cell_name: { type: 'string', description: 'Cell name or partial name.' },
        meetings: { type: 'number', description: 'Number of past meetings to include (default 10).' },
      },
      required: ['cell_name'],
    },
  },

  // ── Church-wide overview ──────────────────────────────────────────────
  {
    name: 'get_all_cells_summary',
    description: `All active cells ranked by recent activity: member count, meetings held in the last 6 weeks, total attendance in that period, and last meeting date. Good for a pastor overview of which cells are thriving vs struggling.`,
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_service_trend',
    description: `Last N Sunday and midweek services with headcount, first-timers, and souls won. Shows attendance trends across main services.`,
    input_schema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of past services to return (default 8).' },
      },
      required: [],
    },
  },

  // ── Pastoral & follow-up ─────────────────────────────────────────────
  {
    name: 'get_pending_follow_ups',
    description: `All pending first-timer and pastoral follow-up tasks, with name, phone, event attended, date, and any notes. Use when asked about who needs follow-up or how many first-timers are in the queue.`,
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 50).' },
      },
      required: [],
    },
  },
  {
    name: 'get_new_members',
    description: `People whose first-ever attendance was within the last N days. Useful for identifying newcomers who need to be placed in a cell or followed up with.`,
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Lookback window in days (default 30).' },
      },
      required: [],
    },
  },
  {
    name: 'get_birthdays',
    description: `Members with birthdays in a given month. Returns name, phone, cell, and birthdate. Defaults to the current month.`,
    input_schema: {
      type: 'object',
      properties: {
        month: { type: 'number', description: '1–12 month number. Defaults to current month.' },
      },
      required: [],
    },
  },

  // ── Catch-all ─────────────────────────────────────────────────────────
  {
    name: 'run_sql',
    description: `Execute a custom read-only SQL SELECT for anything not covered by the other tools — complex filters, comparisons, ranked lists, cross-table joins. Always filter by church_id. No mutations.`,
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'PostgreSQL SELECT or WITH…SELECT statement.' },
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
  meeting_day smallint (0=Sun…6=Sat), meeting_time text, location text, is_active boolean

groups — ministry groupings that contain cells (e.g. MEGA, YPZ)
  id uuid, church_id uuid, name text

giving — donation records
  id uuid, church_id uuid, person_id uuid, person_name text,
  amount numeric, fund text, method text, given_at date

follow_ups — first-timer and pastoral follow-up tasks
  id uuid, church_id uuid, person_id uuid, person_name text,
  phone text, event_name text, event_date date, message text,
  status text ('pending' | 'sent' | 'dismissed')

Key relationships:
  attendance.person_id → people.id
  attendance.event_id  → events.id
  events.cell_id       → cells.id
  people.cell_name     = cells.name (denormalized text, not a FK)
  people.group_name    = groups.name (denormalized text, not a FK)
`

const BASE_SYSTEM = `You are Aquila Agent — a knowledgeable, warm AI assistant embedded inside Aquila, a church management platform used by pastors and church administrators.

You have access to the church's live database through purpose-built tools. When someone asks about attendance, members, cells, giving, events, or follow-ups — use the right tool immediately. Never say you don't have access to data. Be confident and direct.

CRITICAL — conversation context:
- You have the full conversation history. Read it before every response.
- If a person or cell was already looked up, do not search again — build on what you already have.
- When a user says "pull her up", "what about X", "show me" — look at what was just discussed.
- If the user gives a list of names to check, work through them systematically.

${SCHEMA}

How to use the tools:
- Any question naming a specific person → find_person first, then get_member_profile for depth
- Any question about a cell (health, attendance, who's slipping) → get_cell_deep_dive first
- Who in a cell skips services? → get_cell_only_members
- Who skips cell but comes to service? → get_midweek_only_members
- Who has gone completely quiet? → get_absent_from_both
- Is the cell growing or shrinking? → get_cell_attendance_trend
- Pastor overview across all cells → get_all_cells_summary
- Service headcounts / trends → get_service_trend
- Follow-up queue → get_pending_follow_ups
- New faces that need a cell → get_new_members
- Pastoral care / birthdays → get_birthdays
- Anything else → run_sql

Rules for run_sql:
- Always filter WHERE church_id = '<CHURCH_ID>'
- Cell meetings: events WHERE cell_id IS NOT NULL
- Services: events WHERE cell_id IS NULL AND service_type IN ('sunday_inperson','sunday_online','midweek')
- Use LIMIT (max 200) unless a full count is needed
- Never guess — if a query returns 0 rows, say so and suggest verifying the name

CRITICAL — accuracy:
- Never say "never attended" or "always present" without a query that proves it
- When a name is ambiguous, state the full name and cell before answering
- If a result seems surprising, run a verification query
- 0 rows means no data found — not that the person doesn't exist

Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

Format responses using markdown:
- **bold** for numbers and key highlights
- Name any specific person as a markdown link: [First Last](person:UUID) — always SELECT id when querying people
- Bulleted or numbered lists for multiple people/items
- ## headings only for multi-section responses
- Keep responses concise, warm, and pastoral
- Give real answers from the data — names, numbers, dates`

/* ─── Tool labels shown to the user during execution ─── */
const TOOL_LABEL: Record<string, (input: Record<string, unknown>) => string> = {
  find_person:             (i) => `Looking up ${(i as { name: string }).name}…`,
  get_member_profile:      ()  => `Pulling up full profile…`,
  get_cell_deep_dive:      (i) => `Deep diving into ${(i as { cell_name: string }).cell_name}…`,
  get_cell_only_members:   (i) => `Finding cell-only members in ${(i as { cell_name: string }).cell_name}…`,
  get_midweek_only_members:(i) => `Finding service-only members in ${(i as { cell_name: string }).cell_name}…`,
  get_absent_from_both:    (i) => `Finding who's gone quiet in ${(i as { cell_name: string }).cell_name}…`,
  get_cell_attendance_trend:(i) => `Loading attendance trend for ${(i as { cell_name: string }).cell_name}…`,
  get_all_cells_summary:   ()  => `Loading all cells overview…`,
  get_service_trend:       ()  => `Loading service attendance trends…`,
  get_pending_follow_ups:  ()  => `Loading follow-up queue…`,
  get_new_members:         ()  => `Finding new members…`,
  get_birthdays:           ()  => `Checking birthdays…`,
  run_sql:                 (i) => (i as { description?: string }).description ?? 'Running query…',
}

/* ─── Execute a single tool call ─── */
async function executeTool(
  block: Anthropic.ToolUseBlock,
  admin: ReturnType<typeof getAdminClient> | null,
  ctx:   Awaited<ReturnType<typeof getChurchContext>>,
): Promise<string> {
  if (!admin || !ctx) return 'Tool unavailable.'
  const cid = ctx.churchId
  const db = admin

  async function sql(query: string): Promise<unknown> {
    const { data, error } = await db.rpc('execute_readonly_sql', { sql: query }).single()
    if (error) throw new Error(error.message)
    return data
  }

  // ── find_person ─────────────────────────────────────────────────────
  if (block.name === 'find_person') {
    const { name } = block.input as { name: string }
    const terms = name.trim().split(/\s+/)
    let q = db.from('people').select('id, first_name, last_name, cell_name, group_name, phone').eq('church_id', cid)
    if (terms.length === 1) {
      q = q.or(`first_name.ilike.%${terms[0]}%,last_name.ilike.%${terms[0]}%`)
    } else {
      q = q.or(`and(first_name.ilike.%${terms[0]}%,last_name.ilike.%${terms[1]}%),and(first_name.ilike.%${terms[1]}%,last_name.ilike.%${terms[0]}%)`)
    }
    const { data, error } = await q.limit(10)
    if (error) return `Error: ${error.message}`
    if (!data?.length) return `No one found matching "${name}". Try a different spelling or just the first name.`
    return JSON.stringify(data)
  }

  // ── get_member_profile ──────────────────────────────────────────────
  if (block.name === 'get_member_profile') {
    const { person_id } = block.input as { person_id: string }
    const pid = esc(person_id)
    const [profileRes, attRes, givingRes, fuRes] = await Promise.all([
      db.from('people').select('*').eq('id', person_id).single(),
      sql(`
        SELECT e.name AS event_name, e.event_date, e.service_type,
          CASE WHEN e.cell_id IS NULL THEN 'service' ELSE 'cell_meeting' END AS event_kind
        FROM attendance a JOIN events e ON e.id = a.event_id
        WHERE a.person_id = '${pid}' AND a.church_id = '${cid}' AND a.attendance_status = 'present'
        ORDER BY e.event_date DESC LIMIT 200
      `),
      db.from('giving').select('amount, fund, given_at, method').eq('person_id', person_id).eq('church_id', cid).order('given_at', { ascending: false }).limit(20),
      db.from('follow_ups').select('status, event_name, event_date, message').eq('person_id', person_id).eq('church_id', cid).limit(10),
    ])
    const att = (Array.isArray(attRes) ? attRes : []) as { event_kind: string; event_date: string }[]
    return JSON.stringify({
      profile:    profileRes.data,
      attendance: { total: att.length, services: att.filter(e => e.event_kind === 'service').length, cell_meetings: att.filter(e => e.event_kind === 'cell_meeting').length, last_seen: att[0]?.event_date ?? null, history: att.slice(0, 50) },
      giving:     givingRes.data ?? [],
      follow_ups: fuRes.data ?? [],
    })
  }

  // ── get_cell_deep_dive ──────────────────────────────────────────────
  if (block.name === 'get_cell_deep_dive') {
    const { cell_name } = block.input as { cell_name: string }
    const cell = esc(cell_name)
    const data = await sql(`
      WITH members AS (
        SELECT id, first_name, last_name, phone, group_name, pastor
        FROM people
        WHERE church_id = '${cid}' AND cell_name ILIKE '%${cell}%'
      ),
      cell_att AS (
        SELECT a.person_id,
          COUNT(*) FILTER (WHERE a.attendance_status = 'present') AS cnt,
          MAX(e.event_date) FILTER (WHERE a.attendance_status = 'present') AS last_cell
        FROM attendance a JOIN events e ON e.id = a.event_id
        WHERE a.church_id = '${cid}' AND e.cell_id IS NOT NULL
          AND e.event_date >= NOW() - INTERVAL '90 days'
          AND a.person_id IN (SELECT id FROM members)
        GROUP BY a.person_id
      ),
      svc_att AS (
        SELECT a.person_id,
          COUNT(*) FILTER (WHERE a.attendance_status = 'present') AS cnt,
          MAX(e.event_date) FILTER (WHERE a.attendance_status = 'present') AS last_service
        FROM attendance a JOIN events e ON e.id = a.event_id
        WHERE a.church_id = '${cid}' AND e.cell_id IS NULL
          AND e.service_type IN ('sunday_inperson','sunday_online','midweek')
          AND e.event_date >= NOW() - INTERVAL '90 days'
          AND a.person_id IN (SELECT id FROM members)
        GROUP BY a.person_id
      ),
      recent AS (
        SELECT a.person_id, COUNT(*) FILTER (WHERE a.attendance_status = 'present') AS cnt
        FROM attendance a JOIN events e ON e.id = a.event_id
        WHERE a.church_id = '${cid}' AND e.cell_id IS NOT NULL
          AND e.event_date >= NOW() - INTERVAL '45 days'
          AND a.person_id IN (SELECT id FROM members)
        GROUP BY a.person_id
      ),
      older AS (
        SELECT a.person_id, COUNT(*) FILTER (WHERE a.attendance_status = 'present') AS cnt
        FROM attendance a JOIN events e ON e.id = a.event_id
        WHERE a.church_id = '${cid}' AND e.cell_id IS NOT NULL
          AND e.event_date >= NOW() - INTERVAL '90 days'
          AND e.event_date < NOW() - INTERVAL '45 days'
          AND a.person_id IN (SELECT id FROM members)
        GROUP BY a.person_id
      )
      SELECT
        m.id, m.first_name, m.last_name, m.phone, m.group_name, m.pastor,
        COALESCE(c.cnt, 0)   AS cell_meetings_90d,
        COALESCE(s.cnt, 0)   AS services_90d,
        c.last_cell,
        s.last_service,
        GREATEST(c.last_cell, s.last_service) AS last_seen,
        CASE
          WHEN COALESCE(r.cnt, 0) = 0 AND COALESCE(o.cnt, 0) = 0 THEN 'inactive'
          WHEN COALESCE(r.cnt, 0) = 0 AND COALESCE(o.cnt, 0) > 0 THEN 'gone_quiet'
          WHEN COALESCE(r.cnt, 0) > COALESCE(o.cnt, 0)           THEN 'improving'
          WHEN COALESCE(r.cnt, 0) < COALESCE(o.cnt, 0)           THEN 'declining'
          ELSE 'steady'
        END AS trend
      FROM members m
      LEFT JOIN cell_att c  ON c.person_id = m.id
      LEFT JOIN svc_att  s  ON s.person_id = m.id
      LEFT JOIN recent   r  ON r.person_id = m.id
      LEFT JOIN older    o  ON o.person_id = m.id
      ORDER BY last_seen DESC NULLS LAST
    `)
    return JSON.stringify(data ?? [])
  }

  // ── get_cell_only_members ────────────────────────────────────────────
  if (block.name === 'get_cell_only_members') {
    const { cell_name, weeks } = block.input as { cell_name: string; weeks?: number }
    const cell = esc(cell_name)
    const w = clampInt(weeks, 1, 52, 4)
    const data = await sql(`
      WITH members AS (
        SELECT id, first_name, last_name, phone, group_name
        FROM people WHERE church_id = '${cid}' AND cell_name ILIKE '%${cell}%'
      ),
      cell_att AS (
        SELECT a.person_id, COUNT(*) AS cnt, MAX(e.event_date) AS last_date
        FROM attendance a JOIN events e ON e.id = a.event_id
        WHERE a.church_id = '${cid}' AND e.cell_id IS NOT NULL
          AND a.attendance_status = 'present'
          AND e.event_date >= NOW() - INTERVAL '${w} weeks'
          AND a.person_id IN (SELECT id FROM members)
        GROUP BY a.person_id
      ),
      svc_att AS (
        SELECT DISTINCT a.person_id
        FROM attendance a JOIN events e ON e.id = a.event_id
        WHERE a.church_id = '${cid}' AND e.cell_id IS NULL
          AND e.service_type IN ('sunday_inperson','sunday_online','midweek')
          AND a.attendance_status = 'present'
          AND e.event_date >= NOW() - INTERVAL '${w} weeks'
          AND a.person_id IN (SELECT id FROM members)
      )
      SELECT m.id, m.first_name, m.last_name, m.phone, m.group_name,
        c.cnt AS cell_meetings_attended, c.last_date AS last_cell
      FROM members m
      JOIN cell_att c ON c.person_id = m.id
      WHERE m.id NOT IN (SELECT person_id FROM svc_att)
      ORDER BY c.last_date DESC NULLS LAST
    `)
    return JSON.stringify(data ?? [])
  }

  // ── get_midweek_only_members ─────────────────────────────────────────
  if (block.name === 'get_midweek_only_members') {
    const { cell_name, weeks } = block.input as { cell_name: string; weeks?: number }
    const cell = esc(cell_name)
    const w = clampInt(weeks, 1, 52, 4)
    const data = await sql(`
      WITH members AS (
        SELECT id, first_name, last_name, phone, group_name
        FROM people WHERE church_id = '${cid}' AND cell_name ILIKE '%${cell}%'
      ),
      svc_att AS (
        SELECT a.person_id, COUNT(*) AS cnt, MAX(e.event_date) AS last_date
        FROM attendance a JOIN events e ON e.id = a.event_id
        WHERE a.church_id = '${cid}' AND e.cell_id IS NULL
          AND e.service_type IN ('sunday_inperson','sunday_online','midweek')
          AND a.attendance_status = 'present'
          AND e.event_date >= NOW() - INTERVAL '${w} weeks'
          AND a.person_id IN (SELECT id FROM members)
        GROUP BY a.person_id
      ),
      cell_att AS (
        SELECT DISTINCT a.person_id
        FROM attendance a JOIN events e ON e.id = a.event_id
        WHERE a.church_id = '${cid}' AND e.cell_id IS NOT NULL
          AND a.attendance_status = 'present'
          AND e.event_date >= NOW() - INTERVAL '${w} weeks'
          AND a.person_id IN (SELECT id FROM members)
      )
      SELECT m.id, m.first_name, m.last_name, m.phone, m.group_name,
        s.cnt AS services_attended, s.last_date AS last_service
      FROM members m
      JOIN svc_att s ON s.person_id = m.id
      WHERE m.id NOT IN (SELECT person_id FROM cell_att)
      ORDER BY s.last_date DESC NULLS LAST
    `)
    return JSON.stringify(data ?? [])
  }

  // ── get_absent_from_both ─────────────────────────────────────────────
  if (block.name === 'get_absent_from_both') {
    const { cell_name, weeks } = block.input as { cell_name: string; weeks?: number }
    const cell = esc(cell_name)
    const w = clampInt(weeks, 1, 52, 4)
    const data = await sql(`
      WITH members AS (
        SELECT id, first_name, last_name, phone, group_name
        FROM people WHERE church_id = '${cid}' AND cell_name ILIKE '%${cell}%'
      ),
      recent_any AS (
        SELECT DISTINCT a.person_id
        FROM attendance a JOIN events e ON e.id = a.event_id
        WHERE a.church_id = '${cid}' AND a.attendance_status = 'present'
          AND e.event_date >= NOW() - INTERVAL '${w} weeks'
          AND a.person_id IN (SELECT id FROM members)
      ),
      last_seen AS (
        SELECT a.person_id, MAX(e.event_date) AS last_seen_ever
        FROM attendance a JOIN events e ON e.id = a.event_id
        WHERE a.church_id = '${cid}' AND a.attendance_status = 'present'
          AND a.person_id IN (SELECT id FROM members)
        GROUP BY a.person_id
      )
      SELECT m.id, m.first_name, m.last_name, m.phone, m.group_name,
        l.last_seen_ever
      FROM members m
      LEFT JOIN recent_any r ON r.person_id = m.id
      LEFT JOIN last_seen  l ON l.person_id = m.id
      WHERE r.person_id IS NULL
      ORDER BY l.last_seen_ever DESC NULLS LAST
    `)
    return JSON.stringify(data ?? [])
  }

  // ── get_cell_attendance_trend ────────────────────────────────────────
  if (block.name === 'get_cell_attendance_trend') {
    const { cell_name, meetings } = block.input as { cell_name: string; meetings?: number }
    const cell = esc(cell_name)
    const m = clampInt(meetings, 1, 52, 10)
    const data = await sql(`
      SELECT e.name, e.event_date,
        COUNT(*) FILTER (WHERE a.attendance_status = 'present') AS present,
        COUNT(*) FILTER (WHERE a.attendance_status = 'absent')  AS absent
      FROM events e
      LEFT JOIN attendance a ON a.event_id = e.id AND a.church_id = '${cid}'
      WHERE e.church_id = '${cid}'
        AND e.cell_id = (
          SELECT id FROM cells
          WHERE church_id = '${cid}' AND name ILIKE '%${cell}%'
          ORDER BY is_active DESC LIMIT 1
        )
      GROUP BY e.id, e.name, e.event_date
      ORDER BY e.event_date DESC
      LIMIT ${m}
    `)
    return JSON.stringify(data ?? [])
  }

  // ── get_all_cells_summary ────────────────────────────────────────────
  if (block.name === 'get_all_cells_summary') {
    const data = await sql(`
      SELECT c.name, c.leader_name,
        COUNT(DISTINCT p.id) AS total_members,
        COUNT(*)        FILTER (WHERE e.event_date >= NOW() - INTERVAL '6 weeks' AND a.attendance_status = 'present') AS recent_attendance,
        COUNT(DISTINCT e.id) FILTER (WHERE e.event_date >= NOW() - INTERVAL '6 weeks')                               AS recent_meetings,
        MAX(e.event_date) AS last_meeting
      FROM cells c
      LEFT JOIN people p ON p.cell_name = c.name AND p.church_id = '${cid}'
      LEFT JOIN events e ON e.cell_id = c.id AND e.church_id = '${cid}'
      LEFT JOIN attendance a ON a.event_id = e.id AND a.church_id = '${cid}'
      WHERE c.church_id = '${cid}' AND c.is_active = true
      GROUP BY c.id, c.name, c.leader_name
      ORDER BY recent_attendance DESC
    `)
    return JSON.stringify(data ?? [])
  }

  // ── get_service_trend ────────────────────────────────────────────────
  if (block.name === 'get_service_trend') {
    const { count } = block.input as { count?: number }
    const n = clampInt(count, 1, 52, 8)
    const data = await sql(`
      SELECT e.name, e.event_date, e.service_type,
        COUNT(*) FILTER (WHERE a.attendance_status = 'present') AS present,
        e.first_timers, e.soul_won
      FROM events e
      LEFT JOIN attendance a ON a.event_id = e.id AND a.church_id = '${cid}'
      WHERE e.church_id = '${cid}' AND e.cell_id IS NULL
        AND e.service_type IN ('sunday_inperson','sunday_online','midweek')
      GROUP BY e.id, e.name, e.event_date, e.service_type, e.first_timers, e.soul_won
      ORDER BY e.event_date DESC
      LIMIT ${n}
    `)
    return JSON.stringify(data ?? [])
  }

  // ── get_pending_follow_ups ───────────────────────────────────────────
  if (block.name === 'get_pending_follow_ups') {
    const { limit } = block.input as { limit?: number }
    const n = clampInt(limit, 1, 200, 50)
    const data = await sql(`
      SELECT fu.id, fu.person_name, fu.phone, fu.event_name, fu.event_date,
        fu.message, fu.status, p.id AS person_id, p.cell_name
      FROM follow_ups fu
      LEFT JOIN people p ON p.id = fu.person_id AND p.church_id = '${cid}'
      WHERE fu.church_id = '${cid}' AND fu.status = 'pending'
      ORDER BY fu.event_date DESC
      LIMIT ${n}
    `)
    return JSON.stringify(data ?? [])
  }

  // ── get_new_members ──────────────────────────────────────────────────
  if (block.name === 'get_new_members') {
    const { days } = block.input as { days?: number }
    const d = clampInt(days, 1, 365, 30)
    const data = await sql(`
      WITH first_att AS (
        SELECT a.person_id, MIN(e.event_date) AS first_attendance
        FROM attendance a JOIN events e ON e.id = a.event_id
        WHERE a.church_id = '${cid}' AND a.attendance_status = 'present'
        GROUP BY a.person_id
        HAVING MIN(e.event_date) >= NOW() - INTERVAL '${d} days'
      )
      SELECT p.id, p.first_name, p.last_name, p.phone, p.cell_name,
        p.group_name, p.who_invited, p.joined_oasis,
        fa.first_attendance
      FROM people p
      JOIN first_att fa ON fa.person_id = p.id
      WHERE p.church_id = '${cid}'
      ORDER BY fa.first_attendance DESC
    `)
    return JSON.stringify(data ?? [])
  }

  // ── get_birthdays ────────────────────────────────────────────────────
  if (block.name === 'get_birthdays') {
    const { month } = block.input as { month?: number }
    const m = clampInt(month, 1, 12, new Date().getMonth() + 1)
    const data = await sql(`
      SELECT id, first_name, last_name, phone, cell_name, group_name, birthdate
      FROM people
      WHERE church_id = '${cid}'
        AND birthdate IS NOT NULL
        AND EXTRACT(MONTH FROM birthdate) = ${m}
      ORDER BY EXTRACT(DAY FROM birthdate)
    `)
    return JSON.stringify(data ?? [])
  }

  // ── run_sql ──────────────────────────────────────────────────────────
  if (block.name === 'run_sql') {
    const { query } = block.input as { query: string }
    if (!isSafeQuery(query)) return 'Error: only SELECT queries are permitted.'
    try {
      const data = await sql(query)
      const result = JSON.stringify(data ?? [])
      return result.length > 12000 ? result.slice(0, 12000) + '\n[...truncated]' : result
    } catch (err) {
      return `Query error: ${err instanceof Error ? err.message : String(err)}`
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
            const apiStream = anthropic.messages.stream({
              model:      'claude-sonnet-4-6',
              max_tokens: 16000,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              thinking:   { type: 'enabled', budget_tokens: 10000 } as any,
              system:     systemPrompt,
              tools:      tools as Anthropic.Tool[],
              messages:   msgs,
            })

            apiStream.on('text', (delta) => send('text', { delta }))

            const finalMsg = await apiStream.finalMessage()

            if (finalMsg.stop_reason !== 'tool_use') break

            const toolBlocks = finalMsg.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
            )

            for (const block of toolBlocks) {
              const label = TOOL_LABEL[block.name]?.(block.input as Record<string, unknown>) ?? `${block.name}…`
              send('tool', { label })
            }

            const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
              toolBlocks.map(async (block) => ({
                type:        'tool_result' as const,
                tool_use_id: block.id,
                content:     await executeTool(block, admin, ctx).catch(e => `Error: ${e instanceof Error ? e.message : String(e)}`),
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
        'Content-Type':      'text/event-stream',
        'Cache-Control':     'no-cache, no-transform',
        'Connection':        'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    console.error('[chat]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

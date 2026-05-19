import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function getAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: key })
}

const SYSTEM = `You are a church analytics AI. Given a natural language question about church attendance data, return ONLY valid JSON (no markdown, no preamble) with this exact shape:

{
  "sql": "SELECT ... FROM ... WHERE ... ORDER BY ... LIMIT 50",
  "chart": {
    "type": "bar" | "horizontal_bar" | "line" | "area" | "pie" | "table",
    "title": "Short chart title",
    "description": "One sentence describing what is shown",
    "xKey": "column_name_for_x_axis_or_label",
    "yKeys": [
      { "key": "column_name", "label": "Human label", "color": "#4068E2" }
    ]
  },
  "insight": "2–3 sentences interpreting the results. Lead with the most important finding."
}

DATABASE SCHEMA (PostgreSQL):
  groups(id uuid, name text)
  events(id uuid, group_id uuid, event_date date, service_type text, name text)
    -- service_type values: 'sunday_inperson' | 'sunday_online' | 'midweek' | 'cell' | 'outreach' | 'prayer' | 'other'
  people(id uuid, first_name text, last_name text, phone text, group_name text, cell_name text, designation text)
  attendance(id uuid, event_id uuid, person_id uuid, attendance_status text)
    -- attendance_status: 'present' → always filter with attendance_status = 'present'

RELATIONSHIPS:
  events.group_id → groups.id
  attendance.event_id → events.id
  attendance.person_id → people.id

SQL RULES:
  1. SELECT only — no INSERT/UPDATE/DELETE/DROP
  2. Always end with ORDER BY and LIMIT 50
  3. Use ILIKE for name/type searches
  4. Filter: AND att.attendance_status = 'present'
  5. Date range: default to last 90 days unless user specifies
  6. Aggregate by event NAME for cell breakdowns (not by individual event row)
  7. Never expose person IDs or breeze_id in results
  8. For full name: use p.first_name || ' ' || p.last_name

CHART TYPE GUIDE:
  bar          — a few categories, vertical, good for comparison
  horizontal_bar — many categories with long names (cells, attendees)
  line         — time series trend (use "week" or "month" on x-axis)
  area         — time series with volume emphasis
  pie          — proportions (max 6 slices, use for breakdowns like new vs returning)
  table        — detailed lists, multi-column, when chart adds no value

COLOR PALETTE (use these):
  #4068E2 (blue), #059669 (green), #D97706 (amber), #0891B2 (teal),
  #7C3AED (purple), #DC2626 (red), #6B7280 (gray), #EC4899 (pink)

For multi-series charts (line/bar with multiple groups), assign one color per series.`

export interface ChartConfig {
  type: 'bar' | 'horizontal_bar' | 'line' | 'area' | 'pie' | 'table'
  title: string
  description: string
  xKey: string
  yKeys: { key: string; label: string; color: string }[]
}

export interface AIAnalyticsResponse {
  chart: ChartConfig
  data: Record<string, unknown>[]
  insight: string
  sql: string
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json() as { prompt: string }
    if (!prompt?.trim()) {
      return Response.json({ error: 'No prompt provided' }, { status: 400 })
    }

    const anthropic = getAnthropic()

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt.trim() }],
    })

    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''

    // Strip markdown code fences if present
    const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

    let parsed: { sql: string; chart: ChartConfig; insight: string }
    try {
      parsed = JSON.parse(clean)
    } catch {
      console.error('[ai-analytics] Bad JSON from Claude:', raw)
      return Response.json({ error: 'AI returned invalid JSON', raw }, { status: 500 })
    }

    // Validate the SQL is a SELECT or CTE
    const safeSql = (parsed.sql ?? '').trim()
    const sqlLower = safeSql.toLowerCase()
    if (!sqlLower.startsWith('select') && !sqlLower.startsWith('with')) {
      return Response.json({ error: 'AI generated non-SELECT query' }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data, error } = await supabase.rpc('run_query', { sql: safeSql })

    if (error) {
      return Response.json({ error: error.message, sql: safeSql }, { status: 500 })
    }

    return Response.json({
      chart:   parsed.chart,
      data:    data ?? [],
      insight: parsed.insight,
      sql:     safeSql,
    } satisfies AIAnalyticsResponse)
  } catch (err) {
    console.error('[ai-analytics]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

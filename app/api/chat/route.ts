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

  // Load distinct meeting names per group so the AI knows what events exist
  const { data: meetingNames } = await supabase
    .from('meetings')
    .select('name, meeting_type, groups(name)')
    .order('name')

  const byGroup: Record<string, string[]> = {}
  for (const m of meetingNames ?? []) {
    const gName = (m.groups as unknown as { name: string } | null)?.name ?? 'Unknown'
    if (!byGroup[gName]) byGroup[gName] = []
    const label = `${m.name} (${m.meeting_type})`
    if (!byGroup[gName].includes(label)) byGroup[gName].push(label)
  }

  const meetingList = Object.entries(byGroup)
    .map(([g, names]) => `  ${g}:\n${names.map(n => `    - ${n}`).join('\n')}`)
    .join('\n')

  const prompt = `You are the Oasis PFCC Church Intelligence Assistant. You help church leadership understand attendance patterns, member engagement, and group health across ministry groups.

TODAY'S DATE: ${new Date().toISOString().split('T')[0]}

DATABASE SUMMARY:
- Groups: ${(groups ?? []).map(g => g.name).join(', ')}
- Total attendees: ${totalAttendees ?? 0}
- Total meetings: ${totalMeetings ?? 0}
- Total attendance records: ${totalAttendance ?? 0}

KNOWN MEETING EVENTS:
${meetingList}

SCHEMA (PostgreSQL):
\`\`\`
groups       → id uuid, name text
meetings     → id uuid, group_id uuid, meeting_date date, meeting_type text, name text
attendees    → id uuid, name text  [breeze_id is internal, never query it]
attendance   → id uuid, meeting_id uuid, attendee_id uuid, status text ('present'/'absent'/'late'), created_at timestamptz
\`\`\`

RELATIONSHIPS:
- meetings.group_id → groups.id
- attendance.meeting_id → meetings.id
- attendance.attendee_id → attendees.id

QUERY RULES:
1. Always write SELECT queries only — no INSERT, UPDATE, DELETE, DROP, etc.
2. Always filter attendance with: AND att.status = 'present'  (unless specifically asked about absent/late)
3. Use ILIKE for name/group searches: WHERE g.name ILIKE '%CharmCity%'
4. Always include ORDER BY and LIMIT clauses
5. For "cells" → filter: WHERE m.meeting_type = 'Cell'
6. For "Sunday service" → filter: WHERE m.meeting_type = 'Sunday'
7. For "most attended cell" → aggregate by meeting NAME, not by date
8. For person lookups → use: WHERE att_person.name ILIKE '%first last%'
9. Default date range: last 90 days unless user specifies
10. Never expose breeze_id in results

COMMON QUERY PATTERNS:

-- Who attends a specific cell (by name):
SELECT att_person.name, COUNT(*) as times_attended
FROM attendance att
JOIN meetings m ON m.id = att.meeting_id
JOIN attendees att_person ON att_person.id = att.attendee_id
WHERE m.name ILIKE '%Oasis Towson%' AND att.status = 'present'
GROUP BY att_person.name ORDER BY times_attended DESC;

-- Most attended cells in a group:
SELECT m.name, COUNT(att.id) as total_attendance, COUNT(DISTINCT m.id) as sessions
FROM meetings m
JOIN groups g ON g.id = m.group_id
LEFT JOIN attendance att ON att.meeting_id = m.id AND att.status = 'present'
WHERE g.name ILIKE '%LifeSprings%' AND m.meeting_type = 'Cell'
GROUP BY m.name ORDER BY total_attendance DESC;

-- Who has lapsed (attended before X, not after Y):
SELECT att_person.name, MAX(m.meeting_date) as last_seen
FROM attendees att_person
JOIN attendance att ON att.attendee_id = att_person.id
JOIN meetings m ON m.id = att.meeting_id
WHERE att.status = 'present'
GROUP BY att_person.id, att_person.name
HAVING MAX(m.meeting_date) < '2026-01-01'
ORDER BY last_seen DESC;

-- Headcount trend over time for a group:
SELECT m.meeting_date, m.name, COUNT(att.id) as headcount
FROM meetings m
JOIN groups g ON g.id = m.group_id
LEFT JOIN attendance att ON att.meeting_id = m.id AND att.status = 'present'
WHERE g.name ILIKE '%LifeSprings%' AND m.meeting_type = 'Sunday'
GROUP BY m.id, m.meeting_date, m.name ORDER BY m.meeting_date DESC LIMIT 20;

-- First timers in a date range:
SELECT att_person.name, MIN(m.meeting_date) as first_attendance
FROM attendees att_person
JOIN attendance att ON att.attendee_id = att_person.id
JOIN meetings m ON m.id = att.meeting_id
WHERE att.status = 'present'
GROUP BY att_person.id, att_person.name
HAVING MIN(m.meeting_date) BETWEEN '2026-04-01' AND '2026-05-07'
ORDER BY first_attendance;

RESPONSE STYLE:
- Present data in clean tables when showing lists
- Lead with the direct answer, then supporting detail
- Point out notable patterns (outliers, gaps, trends)
- If a query returns 0 results, say so clearly and suggest why`

  _promptCache = { prompt, expires: Date.now() + 60 * 60 * 1000 }
  return prompt
}

// ── Single tool: run_sql ──────────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: 'run_sql',
    description: 'Execute a read-only SQL SELECT query against the church attendance database. Use this to answer any question about attendance, members, meetings, or groups. Write the exact SQL needed — do not use placeholder values.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sql: {
          type: 'string',
          description: 'A valid PostgreSQL SELECT statement. Must start with SELECT. No INSERT/UPDATE/DELETE/DROP allowed.',
        },
        description: {
          type: 'string',
          description: 'One sentence explaining what this query is looking for.',
        },
      },
      required: ['sql', 'description'],
    },
  },
]

// ── Tool execution ────────────────────────────────────────────
async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  if (name !== 'run_sql') return { error: `Unknown tool: ${name}` }

  const sql = (input.sql as string ?? '').trim()
  if (!sql) return { error: 'No SQL provided.' }

  const supabase = getSupabaseServer()
  const { data, error } = await supabase.rpc('run_query', { sql })

  if (error) return { error: error.message, sql }
  return { rows: data, count: Array.isArray(data) ? data.length : null }
}

// ── Route handler ─────────────────────────────────────────────
export async function POST(req: Request) {
  const { messages: incomingMessages } = await req.json() as {
    messages: { role: string; content: string }[]
  }

  if (!incomingMessages?.length) {
    return Response.json({ reply: 'No message received.' }, { status: 400 })
  }

  const anthropic = getAnthropic()
  const systemPrompt = await buildSystemPrompt()

  const messages: Anthropic.MessageParam[] = incomingMessages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  let finalText = ''

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

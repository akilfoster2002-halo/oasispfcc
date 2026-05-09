import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function getAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: key })
}

const SYSTEM = `You are a ministry follow-up AI assistant. Given a natural language outreach command, return ONLY valid JSON (no markdown, no preamble):

{
  "campaignName": "Short campaign name",
  "sql": "SELECT a.id AS attendee_id, a.name, a.phone FROM attendees a ... WHERE a.phone IS NOT NULL ORDER BY a.name LIMIT 500",
  "messageTemplate": "Hi {{name}}, ...",
  "insight": "One sentence about who this targets and why"
}

DATABASE SCHEMA (PostgreSQL):
  groups(id uuid, name text)  -- CharmCity, LifeSprings, MEGA
  meetings(id uuid, group_id uuid, meeting_date date, meeting_type text, name text)
    -- meeting_type: Sunday | Wednesday | Cell | Prayer | Leadership | Special | Other
  attendees(id uuid, name text, phone text)
  attendance(id uuid, meeting_id uuid, attendee_id uuid, status text)
    -- status: present | absent | late

RELATIONSHIPS:
  meetings.group_id → groups.id
  attendance.meeting_id → meetings.id
  attendance.attendee_id → attendees.id

SQL RULES:
  1. Always include a.phone IS NOT NULL in WHERE clause
  2. Return columns: attendee_id (a.id), name (a.name), phone (a.phone)
  3. Default date range: last 90 days unless specified
  4. SELECT only — no INSERT/UPDATE/DELETE
  5. Use DISTINCT when joining to avoid duplicates
  6. ORDER BY a.name, LIMIT 500

MESSAGE TEMPLATE RULES:
  1. Use {{name}} for the person's first name only
  2. Keep under 160 characters
  3. Warm, pastoral, personal tone — NOT marketing
  4. No exclamation marks overuse
  5. Sound like a caring leader texting personally

COMMAND EXAMPLES:
  "Text first timers from Sunday" → find attendees whose first ever attendance was last Sunday
  "Follow up absent 3 weeks" → attendees who haven't attended in 21+ days
  "Send encouragement to MEGA leaders" → people in Leadership meetings for MEGA group`

export async function POST(req: Request) {
  try {
    const { command } = await req.json() as { command: string }
    if (!command?.trim()) return Response.json({ error: 'No command provided' }, { status: 400 })

    const anthropic = getAnthropic()
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: 'user', content: command.trim() }],
    })

    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
    const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

    let parsed: { campaignName: string; sql: string; messageTemplate: string; insight: string }
    try {
      parsed = JSON.parse(clean)
    } catch {
      return Response.json({ error: 'AI returned invalid JSON', raw }, { status: 500 })
    }

    const safeSql = (parsed.sql ?? '').trim()
    if (!safeSql.toLowerCase().startsWith('select')) {
      return Response.json({ error: 'AI generated non-SELECT query' }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: rows, error } = await supabase.rpc('run_query', { sql: safeSql })
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const recipients = ((rows as { attendee_id: string; name: string; phone: string }[]) ?? [])
      .filter(r => r.phone)
      .map(r => {
        const firstName = r.name?.split(' ')[0] ?? r.name
        return {
          attendee_id: r.attendee_id,
          name: r.name,
          phone: r.phone,
          generated_message: parsed.messageTemplate.replace(/\{\{name\}\}/g, firstName),
        }
      })

    return Response.json({
      campaignName: parsed.campaignName,
      insight: parsed.insight,
      messageTemplate: parsed.messageTemplate,
      recipients,
    })
  } catch (err) {
    console.error('[messaging/command]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

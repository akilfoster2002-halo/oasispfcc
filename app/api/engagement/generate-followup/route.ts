import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServer } from '@/lib/supabase-server'
import type { EngagementFlag } from '@/lib/engagement'

export async function POST(req: Request) {
  try {
    const { attendee_id, flags } = await req.json() as {
      attendee_id: string
      flags: EngagementFlag[]
    }

    const supabase = getSupabaseServer()
    const { data: attendee } = await supabase
      .from('attendees')
      .select('name')
      .eq('id', attendee_id)
      .single()

    const firstName = (attendee?.name ?? 'Friend').split(' ')[0]
    const flagContext = flags.map(f => `- ${f.label}: ${f.detail}`).join('\n')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const res = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 200,
      system: `You write warm, genuine follow-up text messages from a church leader to a member.

Rules:
- Use their first name naturally
- Sound like a real caring person texting, not a system or an organization
- Be brief — under 160 characters when possible
- Be pastoral, warm, relational
- Never reference "our records", "the system", "data", or anything that reveals tracking
- Never be corporate, salesy, or templated-sounding
- Vary sentence structure — don't start every message the same way
- Return ONLY the message text — no quotes, no explanation, nothing else`,
      messages: [{
        role: 'user',
        content: `Write a follow-up text for ${firstName}.\n\nContext about why we're reaching out:\n${flagContext}`,
      }],
    })

    const message = res.content[0]?.type === 'text' ? res.content[0].text.trim() : ''
    return Response.json({ message, firstName })
  } catch (err) {
    console.error('[engagement/generate-followup]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

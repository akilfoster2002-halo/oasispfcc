import Anthropic from '@anthropic-ai/sdk'

const TONE_DESCRIPTIONS: Record<string, string> = {
  warm:        'warm and caring, like a close friend personally checking in',
  encouraging: 'uplifting and positive, celebrating the person and affirming their worth',
  pastoral:    'spiritually grounded and thoughtful, full of grace and depth',
  direct:      'brief and clear, practical without being cold',
}

const BASE_SYSTEM = `You are a pastoral AI assistant helping church leaders respond to text messages from members.

Guidelines:
- Sound like a warm, caring leader personally texting — never corporate or automated
- Be brief (under 160 characters when possible)
- Be natural and human, not generic or promotional
- Reflect genuine pastoral care

SENSITIVE CONTENT: If the message contains emotional distress, grief, crisis, spiritual struggle, or anything requiring deeper care:
- Set "is_sensitive": true
- Keep suggested_reply brief and human
- Add a pastoral_note explaining what care is needed

Return ONLY valid JSON (no markdown, no code blocks):
{
  "suggested_reply": "Reply text here",
  "is_sensitive": false,
  "pastoral_note": null,
  "tone": "warm"
}`

export interface AIReplyResult {
  suggested_reply: string
  is_sensitive: boolean
  pastoral_note: string | null
  tone: string
}

export async function generateAIReply(params: {
  name: string
  history: string
  latest: string
  tone?: string
}): Promise<AIReplyResult> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const toneNote = params.tone && TONE_DESCRIPTIONS[params.tone]
    ? `\n\nTONE REQUESTED: ${TONE_DESCRIPTIONS[params.tone]}. Lean into this quality.`
    : ''

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 512,
    system: BASE_SYSTEM + toneNote,
    messages: [{
      role: 'user',
      content: `Contact: ${params.name ?? 'Unknown'}\n\nConversation history:\n${params.history || '(no prior messages)'}\n\nLatest message to reply to: "${params.latest}"`,
    }],
  })

  const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
  const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  return JSON.parse(clean) as AIReplyResult
}

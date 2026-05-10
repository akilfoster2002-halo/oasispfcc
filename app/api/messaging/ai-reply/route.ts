import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const SYSTEM = `You are a pastoral AI assistant helping church leaders respond to text messages.

Your response should:
- Sound like a warm, caring leader personally texting
- Be brief (under 160 chars when possible)
- Be natural, not corporate or generic
- Reflect genuine pastoral care
- NOT be automated-sounding or promotional

SENSITIVE CONTENT RULES:
If the message contains signs of emotional distress, grief, crisis, spiritual struggle, or anything requiring pastoral care:
- Set "is_sensitive": true
- Keep suggested_reply brief and human
- Add a pastoral_note explaining what care is needed

Return ONLY valid JSON:
{
  "suggested_reply": "Reply text here",
  "is_sensitive": false,
  "pastoral_note": null,
  "tone": "warm | urgent | encouraging | pastoral"
}`

export async function POST(req: Request) {
  try {
    const { name, history, latest } = await req.json() as {
      name: string
      history: string
      latest: string
    }

    if (!latest) return Response.json({ error: 'latest message required' }, { status: 400 })

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 512,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Contact name: ${name ?? 'Unknown'}\nConversation history:\n${history}\n\nLatest message to reply to: "${latest}"`,
      }],
    })

    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
    const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    let parsed: { suggested_reply: string; is_sensitive: boolean; pastoral_note: string | null; tone: string }
    try {
      parsed = JSON.parse(clean)
    } catch {
      return Response.json({ error: 'AI returned invalid JSON', raw }, { status: 500 })
    }

    return Response.json(parsed)
  } catch (err) {
    console.error('[ai-reply]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

import { generateAIReply } from '@/lib/generate-ai-reply'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { name, history, latest, tone } = await req.json() as {
      name: string
      history: string
      latest: string
      tone?: string
    }

    if (!latest) return Response.json({ error: 'latest message required' }, { status: 400 })

    const result = await generateAIReply({ name, history, latest, tone })
    return Response.json(result)
  } catch (err) {
    console.error('[ai-reply]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

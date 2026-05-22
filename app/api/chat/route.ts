import Anthropic from '@anthropic-ai/sdk'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

function getAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: key })
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
      .from('memberships')
      .select('church_id, churches(name, slug)')
      .eq('user_id', user.id)
      .eq('is_approved', true)
      .maybeSingle()

    if (!membership?.church_id) return null

    // Grab quick summary stats
    const churchId = membership.church_id
    const [peopleRes, eventsRes, cellsRes] = await Promise.all([
      supabase.from('people').select('id', { count: 'exact', head: true }).eq('church_id', churchId),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('church_id', churchId),
      supabase.from('cells').select('id', { count: 'exact', head: true }).eq('church_id', churchId).eq('is_active', true),
    ])

    const churches = membership.churches as { name: string } | { name: string }[] | null
    const churchName = (Array.isArray(churches) ? churches[0]?.name : churches?.name) ?? 'your church'

    return {
      churchName,
      totalPeople: peopleRes.count ?? 0,
      totalEvents: eventsRes.count ?? 0,
      totalCells: cellsRes.count ?? 0,
    }
  } catch {
    return null
  }
}

const BASE_SYSTEM = `You are Oasis Assistant — a knowledgeable, warm AI helper embedded inside Aquila, a church management platform used by Oasis PFCC. You help church administrators, pastors, and leaders understand their congregation, plan events, and make data-driven ministry decisions.

You can help with:
- Questions about church management, ministry strategy, and discipleship
- Understanding attendance trends and congregation health
- Planning events, cell groups, and outreach
- Member follow-up and pastoral care guidance
- Interpreting church growth data

Be concise, warm, and pastoral in tone. When you don't know specific data, say so and suggest where they could find it in Aquila. Keep responses focused and actionable. Use plain text — no markdown headers or bullet overload, just clear natural language.`

export async function POST(req: Request) {
  try {
    const { messages } = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[]
    }

    if (!messages?.length) {
      return Response.json({ error: 'No messages provided' }, { status: 400 })
    }

    const ctx = await getChurchContext()

    const systemPrompt = ctx
      ? `${BASE_SYSTEM}\n\nCurrent church context:\n- Church: ${ctx.churchName}\n- Total members in system: ${ctx.totalPeople}\n- Total events recorded: ${ctx.totalEvents}\n- Active cell groups: ${ctx.totalCells}`
      : BASE_SYSTEM

    const anthropic = getAnthropic()

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    const reply = response.content[0]?.type === 'text'
      ? response.content[0].text
      : 'Sorry, I could not generate a response.'

    return Response.json({ reply })
  } catch (err) {
    console.error('[chat]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

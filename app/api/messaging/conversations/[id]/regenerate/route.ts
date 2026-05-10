import { getSupabaseServer } from '@/lib/supabase-server'
import { generateAIReply } from '@/lib/generate-ai-reply'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { message_id, tone } = await req.json() as { message_id?: string; tone?: string }

  const supabase = getSupabaseServer()

  const { data: conv } = await supabase
    .from('conversations')
    .select('phone, name')
    .eq('id', id)
    .single()

  if (!conv) return Response.json({ error: 'Conversation not found' }, { status: 404 })

  // Delete the specified draft (or all pending drafts for this conversation)
  if (message_id) {
    await supabase.from('sms_messages').delete().eq('id', message_id).eq('approved', false)
  } else {
    await supabase.from('sms_messages').delete()
      .eq('conversation_id', id).eq('approved', false).eq('ai_generated', true)
  }

  // Fetch approved history for context
  const { data: historyMsgs } = await supabase
    .from('sms_messages')
    .select('direction, body')
    .eq('conversation_id', id)
    .eq('approved', true)
    .order('created_at', { ascending: true })
    .limit(20)

  const latest = (historyMsgs ?? []).filter(m => m.direction === 'inbound').at(-1)?.body
  if (!latest) return Response.json({ error: 'No inbound message to reply to' }, { status: 400 })

  const historyText = (historyMsgs ?? [])
    .map(m => `${m.direction === 'inbound' ? 'THEM' : 'US'}: ${m.body}`)
    .join('\n')

  const ai = await generateAIReply({ name: conv.name, history: historyText, latest, tone })

  await supabase.from('sms_messages').insert({
    conversation_id: id,
    direction: 'outbound',
    body: ai.suggested_reply,
    ai_generated: true,
    approved: false,
    tone: ai.tone ?? tone ?? null,
    pastoral_note: ai.pastoral_note ?? null,
    is_sensitive: ai.is_sensitive ?? false,
  })

  return Response.json({ ok: true })
}

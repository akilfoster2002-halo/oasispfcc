import { getSupabaseServer } from '@/lib/supabase-server'
import { sendSMS } from '@/lib/clearstream'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { body: overrideBody } = await req.json() as { body?: string }

  const supabase = getSupabaseServer()

  const { data: msg } = await supabase
    .from('sms_messages')
    .select('body, conversation_id, approved')
    .eq('id', id)
    .single()

  if (!msg) return Response.json({ error: 'Message not found' }, { status: 404 })
  if (msg.approved) return Response.json({ error: 'Already sent' }, { status: 400 })

  const { data: conv } = await supabase
    .from('conversations')
    .select('phone')
    .eq('id', msg.conversation_id)
    .single()

  if (!conv) return Response.json({ error: 'Conversation not found' }, { status: 404 })

  const sendBody = overrideBody?.trim() || msg.body
  const result = await sendSMS(conv.phone, sendBody)
  const now = new Date().toISOString()

  await supabase.from('sms_messages').update({
    body: sendBody,
    approved: true,
    sent_at: now,
    clearstream_id: String(result.id),
  }).eq('id', id)

  await supabase.from('conversations').update({
    last_message_at: now,
    updated_at: now,
  }).eq('id', msg.conversation_id)

  return Response.json({ ok: true })
}

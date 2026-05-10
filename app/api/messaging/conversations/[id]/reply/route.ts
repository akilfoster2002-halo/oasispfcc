import { getSupabaseServer } from '@/lib/supabase-server'
import { sendSMS } from '@/lib/clearstream'

export const dynamic = 'force-dynamic'

// POST: approve an existing AI message OR send a new manual message
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as {
    message_id?: string   // approve existing AI-generated message
    body?: string         // send new manual message
    edited_body?: string  // override body of existing message_id before sending
  }

  const supabase = getSupabaseServer()
  const { data: conv } = await supabase.from('conversations').select('phone, name').eq('id', id).single()
  if (!conv) return Response.json({ error: 'Conversation not found' }, { status: 404 })

  let messageBody: string
  let messageId: string | null = null

  if (body.message_id) {
    // Approving an AI-generated suggestion
    const { data: msg } = await supabase.from('sms_messages').select('body').eq('id', body.message_id).single()
    if (!msg) return Response.json({ error: 'Message not found' }, { status: 404 })
    messageBody = body.edited_body ?? msg.body
    messageId = body.message_id

    // Update the message body if edited
    if (body.edited_body) {
      await supabase.from('sms_messages').update({ body: body.edited_body }).eq('id', body.message_id)
    }
  } else if (body.body) {
    messageBody = body.body
  } else {
    return Response.json({ error: 'Provide message_id or body' }, { status: 400 })
  }

  // Send via Clearstream
  const result = await sendSMS(conv.phone, messageBody)

  const now = new Date().toISOString()

  if (messageId) {
    // Mark the AI suggestion as approved and sent
    await supabase.from('sms_messages').update({
      approved: true,
      sent_at: now,
      clearstream_id: String(result.id),
    }).eq('id', messageId)
  } else {
    // Create new outbound message
    await supabase.from('sms_messages').insert({
      conversation_id: id,
      direction: 'outbound',
      body: messageBody,
      ai_generated: false,
      approved: true,
      sent_at: now,
      clearstream_id: String(result.id),
    })
  }

  await supabase.from('conversations').update({ last_message_at: now, updated_at: now }).eq('id', id)

  return Response.json({ ok: true, clearstream_id: result.id })
}

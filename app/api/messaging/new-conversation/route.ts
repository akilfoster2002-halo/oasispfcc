import { getSupabaseServer } from '@/lib/supabase-server'
import { sendSMS } from '@/lib/clearstream'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { attendee_id, name, phone, body } = await req.json() as {
      attendee_id: string
      name: string
      phone: string
      body: string
    }

    if (!phone || !body) return Response.json({ error: 'phone and body required' }, { status: 400 })

    const supabase = getSupabaseServer()

    // Upsert conversation
    const { data: conv, error: ce } = await supabase
      .from('conversations')
      .upsert(
        {
          phone,
          name,
          attendee_id: attendee_id ?? null,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'phone', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (ce || !conv) {
      console.error('[new-conversation] upsert failed:', ce)
      return Response.json({ error: 'Failed to create conversation' }, { status: 500 })
    }

    // Send via Clearstream
    const result = await sendSMS(phone, body)

    const now = new Date().toISOString()

    // Save outbound message
    await supabase.from('sms_messages').insert({
      conversation_id: conv.id,
      direction: 'outbound',
      body,
      ai_generated: false,
      approved: true,
      sent_at: now,
      clearstream_id: String(result.id),
    })

    await supabase.from('conversations').update({ last_message_at: now, updated_at: now }).eq('id', conv.id)

    return Response.json({ ok: true, conversation_id: conv.id })
  } catch (err) {
    console.error('[new-conversation]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

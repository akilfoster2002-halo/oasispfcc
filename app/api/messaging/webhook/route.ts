import { getSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// Clearstream webhook — receives inbound SMS (text.received event)
export async function POST(req: Request) {
  try {
    const payload = await req.json()

    if (payload.event !== 'text.received') {
      return Response.json({ ok: true, skipped: true })
    }

    const data = payload.data ?? payload
    const phone: string = data.subscriber?.mobile_number ?? data.from
    const body: string  = data.text
    const firstName: string = data.subscriber?.first ?? ''
    const lastName: string  = data.subscriber?.last  ?? ''
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || null

    if (!phone || !body) {
      return Response.json({ error: 'Missing phone or body' }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    // Find attendee by phone for a better display name
    const { data: attendee } = await supabase
      .from('attendees')
      .select('id, name')
      .eq('phone', phone)
      .maybeSingle()

    const displayName = attendee?.name ?? fullName ?? phone
    const now = new Date().toISOString()

    // Upsert conversation — creates one if it doesn't exist yet
    const { data: conv, error: ce } = await supabase
      .from('conversations')
      .upsert(
        {
          phone,
          name: displayName,
          attendee_id: attendee?.id ?? null,
          last_message_at: now,
          updated_at: now,
        },
        { onConflict: 'phone', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (ce || !conv) {
      console.error('[webhook] upsert conversation failed:', ce)
      return Response.json({ error: 'Failed to upsert conversation' }, { status: 500 })
    }

    // Save the inbound message
    const { data: savedMsg, error: me } = await supabase
      .from('sms_messages')
      .insert({
        conversation_id: conv.id,
        direction: 'inbound',
        body,
        ai_generated: false,
        approved: true,
        sent_at: now,
      })
      .select()
      .single()

    if (me) {
      console.error('[webhook] insert message failed:', me)
      return Response.json({ error: 'Failed to save message' }, { status: 500 })
    }

    return Response.json({ ok: true, conversation_id: conv.id, message_id: savedMsg.id })
  } catch (err) {
    console.error('[webhook]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

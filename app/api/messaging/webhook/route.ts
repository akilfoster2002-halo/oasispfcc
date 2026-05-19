import { getSupabaseServer } from '@/lib/supabase-server'
import { generateAIReply } from '@/lib/generate-ai-reply'

export const dynamic = 'force-dynamic'

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

    const { data: person } = await supabase
      .from('people')
      .select('id, first_name, last_name')
      .eq('phone', phone)
      .maybeSingle()

    const personName = person ? `${person.first_name} ${person.last_name}`.trim() : null
    const displayName = personName ?? fullName ?? phone
    const now = new Date().toISOString()

    const { data: conv, error: ce } = await supabase
      .from('conversations')
      .upsert(
        { phone, name: displayName, person_id: person?.id ?? null, last_message_at: now, updated_at: now },
        { onConflict: 'phone', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (ce || !conv) {
      console.error('[webhook] upsert conversation failed:', ce)
      return Response.json({ error: 'Failed to upsert conversation' }, { status: 500 })
    }

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

    // Auto-generate AI draft (synchronous — Clearstream has generous timeout)
    try {
      // Remove any stale pending drafts from previous unanswered messages
      await supabase.from('sms_messages')
        .delete()
        .eq('conversation_id', conv.id)
        .eq('direction', 'outbound')
        .eq('approved', false)
        .eq('ai_generated', true)

      // Fetch conversation history for context
      const { data: historyMsgs } = await supabase
        .from('sms_messages')
        .select('direction, body')
        .eq('conversation_id', conv.id)
        .eq('approved', true)
        .order('created_at', { ascending: true })
        .limit(20)

      const historyText = (historyMsgs ?? [])
        .map(m => `${m.direction === 'inbound' ? 'THEM' : 'US'}: ${m.body}`)
        .join('\n')

      const ai = await generateAIReply({
        name: displayName,
        history: historyText,
        latest: body,
      })

      if (ai.is_sensitive) {
        await supabase.from('conversations').update({ is_sensitive: true }).eq('id', conv.id)
      }

      await supabase.from('sms_messages').insert({
        conversation_id: conv.id,
        direction: 'outbound',
        body: ai.suggested_reply,
        ai_generated: true,
        approved: false,
        tone: ai.tone ?? null,
        pastoral_note: ai.pastoral_note ?? null,
        is_sensitive: ai.is_sensitive ?? false,
      })
    } catch (err) {
      console.error('[webhook] AI draft generation failed:', err)
    }

    return Response.json({ ok: true, conversation_id: conv.id, message_id: savedMsg.id })
  } catch (err) {
    console.error('[webhook]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

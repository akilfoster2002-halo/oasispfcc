import { getSupabaseServer } from '@/lib/supabase-server'
import { sendSMS } from '@/lib/clearstream'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabaseServer()

  // Load campaign + recipients
  const { data: campaign, error: ce } = await supabase.from('campaigns').select('*').eq('id', id).single()
  if (ce || !campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 })
  if (campaign.status === 'sent') return Response.json({ error: 'Campaign already sent' }, { status: 400 })

  const { data: recipients, error: re } = await supabase
    .from('campaign_recipients')
    .select('*')
    .eq('campaign_id', id)
    .eq('delivery_status', 'pending')
  if (re) return Response.json({ error: re.message }, { status: 500 })
  if (!recipients?.length) return Response.json({ error: 'No pending recipients' }, { status: 400 })

  await supabase.from('campaigns').update({ status: 'sending', updated_at: new Date().toISOString() }).eq('id', id)

  let sentCount = 0
  const errors: string[] = []

  for (const r of recipients) {
    if (!r.phone || !r.generated_message) continue
    try {
      const result = await sendSMS(r.phone, r.generated_message)
      await supabase
        .from('campaign_recipients')
        .update({ delivery_status: 'sent', clearstream_id: String(result.id) })
        .eq('id', r.id)

      // Upsert a conversation thread for each recipient
      const { data: conv } = await supabase
        .from('conversations')
        .upsert(
          { phone: r.phone, name: r.name, attendee_id: r.attendee_id ?? null, status: 'awaiting_followup', last_message_at: new Date().toISOString() },
          { onConflict: 'phone', ignoreDuplicates: false }
        )
        .select()
        .single()

      if (conv) {
        await supabase.from('sms_messages').insert({
          conversation_id: conv.id,
          direction: 'outbound',
          body: r.generated_message,
          approved: true,
          sent_at: new Date().toISOString(),
          clearstream_id: String(result.id),
        })
      }

      sentCount++
    } catch (err) {
      console.error(`[send-campaign] failed for ${r.phone}:`, err)
      await supabase.from('campaign_recipients').update({ delivery_status: 'failed' }).eq('id', r.id)
      errors.push(r.phone)
    }
    // Small delay to avoid rate-limiting
    await new Promise(r => setTimeout(r, 100))
  }

  await supabase.from('campaigns').update({
    status: 'sent',
    sent_count: sentCount,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  return Response.json({ sent: sentCount, failed: errors.length, errors })
}

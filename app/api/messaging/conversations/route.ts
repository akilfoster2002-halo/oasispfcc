import { getSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const supabase = getSupabaseServer()
  let q = supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100)

  if (status) q = q.eq('status', status)

  const { data: convs, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Attach any pending AI draft to each conversation
  const { data: drafts } = await supabase
    .from('sms_messages')
    .select('id, conversation_id, body, tone')
    .eq('direction', 'outbound')
    .eq('approved', false)
    .eq('ai_generated', true)

  const draftMap = Object.fromEntries((drafts ?? []).map(d => [d.conversation_id, d]))
  const result = (convs ?? []).map(c => ({ ...c, pending_draft: draftMap[c.id] ?? null }))

  return Response.json(result)
}

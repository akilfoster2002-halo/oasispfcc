import { getSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabaseServer()
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return Response.json({ error: error.message }, { status: 404 })

  const { data: recipients } = await supabase
    .from('campaign_recipients')
    .select('*')
    .eq('campaign_id', id)
    .order('name')

  return Response.json({ ...campaign, recipients: recipients ?? [] })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const supabase = getSupabaseServer()

  // Allow updating individual recipient messages
  if (body.recipient_id && body.generated_message !== undefined) {
    const { error } = await supabase
      .from('campaign_recipients')
      .update({ generated_message: body.generated_message })
      .eq('id', body.recipient_id)
      .eq('campaign_id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  // Allow removing a recipient
  if (body.remove_recipient_id) {
    await supabase.from('campaign_recipients').delete().eq('id', body.remove_recipient_id).eq('campaign_id', id)
    const { count } = await supabase
      .from('campaign_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', id)
    await supabase.from('campaigns').update({ total_recipients: count ?? 0, updated_at: new Date().toISOString() }).eq('id', id)
    return Response.json({ ok: true })
  }

  // Generic campaign update (status, name, etc.)
  const allowed = ['name', 'status']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) { if (body[k] !== undefined) updates[k] = body[k] }
  const { error } = await supabase.from('campaigns').update(updates).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabaseServer()
  const { error } = await supabase.from('campaigns').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

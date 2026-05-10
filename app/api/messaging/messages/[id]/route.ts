import { getSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabaseServer()

  const { error } = await supabase
    .from('sms_messages')
    .delete()
    .eq('id', id)
    .eq('approved', false) // safety: never delete sent messages

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

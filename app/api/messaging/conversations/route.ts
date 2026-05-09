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

  const { data, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data ?? [])
}

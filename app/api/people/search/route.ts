import { getSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const hasPhone = searchParams.get('hasPhone') === 'true'

  if (!q.trim()) return Response.json([])

  const supabase = getSupabaseServer()
  let query = supabase
    .from('attendees')
    .select('id, name, phone')
    .ilike('name', `%${q}%`)
    .limit(8)

  if (hasPhone) query = query.not('phone', 'is', null)

  const { data, error } = await query
  if (error) return Response.json([], { status: 500 })
  return Response.json(data ?? [])
}

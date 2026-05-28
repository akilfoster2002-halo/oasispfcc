import { getSupabaseServer } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

async function getChurchId(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } },
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return null
    const { data } = await userClient
      .from('church_memberships')
      .select('church_id')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle()
    return data?.church_id ?? null
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const hasPhone = searchParams.get('hasPhone') === 'true'

  if (!q.trim()) return Response.json([])

  const churchId = await getChurchId()
  if (!churchId) return Response.json([], { status: 401 })

  const supabase = getSupabaseServer()
  let query = supabase
    .from('people')
    .select('id, first_name, last_name, phone')
    .eq('church_id', churchId)
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
    .limit(8)

  if (hasPhone) query = query.not('phone', 'is', null)

  const { data, error } = await query
  if (error) return Response.json([], { status: 500 })
  return Response.json(
    (data ?? []).map(p => ({
      id:    p.id,
      name:  `${p.first_name} ${p.last_name}`.trim(),
      phone: p.phone,
    }))
  )
}

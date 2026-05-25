import { getSupabaseServer } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

async function getCallerContext() {
  const cookieStore = await cookies()
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return null
  const [profileRes, membershipRes] = await Promise.all([
    userClient.from('user_profiles').select('role, group_id').eq('id', user.id).single(),
    userClient.from('church_memberships').select('church_id').eq('user_id', user.id).eq('status', 'approved').maybeSingle(),
  ])
  return {
    profile: profileRes.data ?? null,
    churchId: membershipRes.data?.church_id ?? null,
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const supabase = getSupabaseServer()
  const ctx = await getCallerContext()
  if (!ctx?.churchId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { profile, churchId } = ctx

  let q = supabase
    .from('conversations')
    .select('*')
    .eq('church_id', churchId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100)

  if (status) q = q.eq('status', status)

  // Group-scoped users only see conversations for people in their group
  if (profile && profile.role === 'group' && profile.group_id) {
    const { data: rows } = await supabase
      .from('attendance')
      .select('person_id, events!inner(group_id)')
      .eq('events.group_id', profile.group_id)
    const ids = [...new Set((rows ?? []).map((r: { person_id: string }) => r.person_id))]
    if (ids.length === 0) return Response.json([])
    q = q.in('person_id', ids)
  }

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

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const PAID_PLANS = new Set(['starter', 'growth', 'intelligence'])
const FREE_PEOPLE_LIMIT = 100
const FREE_MESSAGES_LIMIT = 5

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } },
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: membership } = await supabase
      .from('church_memberships')
      .select('church_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership?.church_id) return Response.json({ error: 'No church' }, { status: 404 })
    const churchId = membership.church_id

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const [churchRes, usageRes, peopleRes] = await Promise.all([
      admin.from('churches').select('plan, plan_status, agent_daily_limit, ref_code').eq('id', churchId).single(),
      admin.from('agent_daily_usage').select('messages_used').eq('church_id', churchId).eq('usage_date', new Date().toISOString().slice(0, 10)).maybeSingle(),
      admin.from('people').select('id', { count: 'exact', head: true }).eq('church_id', churchId).neq('designation', 'archived'),
    ])

    const church = churchRes.data
    if (!church) return Response.json({ error: 'Church not found' }, { status: 404 })

    const isPaid = PAID_PLANS.has(church.plan) && church.plan_status === 'active'
    const messagesLimit = isPaid ? null : (church.agent_daily_limit ?? FREE_MESSAGES_LIMIT)
    const messagesUsed = usageRes.data?.messages_used ?? 0
    const peopleCount = peopleRes.count ?? 0
    const peopleLimit = isPaid ? null : FREE_PEOPLE_LIMIT

    return Response.json({
      isPaid,
      plan: church.plan,
      refCode: church.ref_code,
      messages: { used: messagesUsed, limit: messagesLimit },
      people: { count: peopleCount, limit: peopleLimit },
    })
  } catch (err) {
    console.error('[freemium/usage]', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

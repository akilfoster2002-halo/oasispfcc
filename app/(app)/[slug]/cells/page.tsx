import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseServer } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Zap, Users, BarChart2, MapPin, RefreshCw } from 'lucide-react'
import CellsClient from '@/components/pages/CellsClient'

const PAID_PLANS = new Set(['starter', 'growth', 'intelligence'])

export default async function CellsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // 1. Get the authenticated user from session cookies
  const cookieStore = await cookies()
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) redirect('/login')

  // 2. Use the same admin client the agent uses
  const supabase = getSupabaseServer()

  // 3. Look up the church
  const { data: church, error: churchErr } = await supabase
    .from('churches')
    .select('id, plan, plan_status')
    .eq('slug', slug)
    .single()

  if (churchErr || !church) redirect('/')

  // 4. Verify this user is an approved member
  const { data: membership } = await supabase
    .from('church_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('church_id', church.id)
    .eq('status', 'approved')
    .maybeSingle()

  if (!membership) redirect('/')

  // 5. Check plan
  const isPaid = PAID_PLANS.has(church.plan) && church.plan_status === 'active'

  if (!isPaid) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 640 }}>
          <div style={{ width: 48, height: 2, borderRadius: 99, marginBottom: 40, background: 'linear-gradient(90deg, #A88A35, #C9A84C)', boxShadow: '0 0 16px rgba(201,168,76,0.40)' }} />
          <div style={{ marginBottom: 48 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 99, marginBottom: 20, background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.18)' }}>
              <Zap style={{ width: 11, height: 11, color: '#C9A84C' }} />
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(201,168,76,0.75)' }}>Premium Feature</span>
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.04em', lineHeight: 1.1, margin: '0 0 16px' }}>
              Cells is a premium feature
            </h1>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.40)', lineHeight: 1.65, margin: 0, maxWidth: 480 }}>
              Organize your congregation into small groups, track attendance at every meeting, and monitor the health of each cell.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, marginBottom: 48, borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
            {([
              { Icon: Users,    title: 'Manage Cell Groups',   desc: 'Create and organize small groups with leaders, schedules, and locations.' },
              { Icon: BarChart2, title: 'Cell Health Metrics', desc: 'Spot your most active cells, flag declining groups, and track growth over time.' },
              { Icon: MapPin,   title: 'Attendance Tracking',  desc: 'Record who shows up to each meeting and see patterns per member.' },
              { Icon: RefreshCw, title: 'Recurring Meetings',  desc: 'Set weekly schedules and auto-generate events across your full calendar.' },
            ] as const).map(({ Icon, title, desc }, i) => (
              <div key={i} style={{ padding: '24px 26px', background: i % 2 === 0 ? 'linear-gradient(145deg,rgba(255,255,255,0.035) 0%,rgba(255,255,255,0.012) 100%)' : 'linear-gradient(145deg,rgba(255,255,255,0.025) 0%,rgba(255,255,255,0.008) 100%)', borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.07)' : 'none', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.18)' }}>
                  <Icon style={{ width: 15, height: 15, color: '#C9A84C' }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.82)', margin: '0 0 5px' }}>{title}</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', margin: 0, lineHeight: 1.55 }}>{desc}</p>
              </div>
            ))}
          </div>
          <Link href={`/${slug}/pricing`} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '11px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#A88A35 0%,#C9A84C 100%)', fontSize: 13, fontWeight: 600, color: '#fff', textDecoration: 'none' }}>
            <Zap style={{ width: 14, height: 14 }} />
            Upgrade to unlock
          </Link>
        </div>
      </div>
    )
  }

  // 6. Fetch cells — same client the agent uses
  const { data: rawCells } = await supabase
    .from('cells')
    .select('id, name, group_id, leader_name, meeting_day, meeting_time, location, color, is_active, created_at')
    .eq('church_id', church.id)
    .eq('is_active', true)
    .order('name')

  // 7. Fetch group names
  const groupIds = [...new Set((rawCells ?? []).map(c => c.group_id).filter((id): id is string => !!id))]
  const { data: groupsData } = groupIds.length
    ? await supabase.from('groups').select('id, name').in('id', groupIds)
    : { data: [] as { id: string; name: string }[] }

  const groupMap: Record<string, string> = {}
  for (const g of groupsData ?? []) groupMap[g.id] = g.name

  const cells = (rawCells ?? []).map(c => ({
    id: c.id as string,
    name: c.name as string,
    group_id: c.group_id as string | null,
    group_name: c.group_id ? (groupMap[c.group_id] ?? null) : null,
    leader_name: c.leader_name as string | null,
    meeting_day: c.meeting_day as number | null,
    meeting_time: c.meeting_time as string | null,
    location: c.location as string | null,
    color: (c.color as string) || '#A88A35',
    is_active: c.is_active as boolean,
    created_at: c.created_at as string,
  }))

  return <CellsClient cells={cells} slug={slug} churchId={church.id} />
}

'use client'

import { use, useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import {
  ArrowLeft, Pencil, Users, CalendarDays, TrendingUp, Activity,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CellInfo {
  id: string
  name: string
  color: string
  group_name: string | null
  meeting_day: number | null
  meeting_time: string | null
  location: string | null
  leader_name: string | null
}

interface CellEvent {
  id: string
  event_date: string
  attendance_count: number
}

interface TopMember {
  person_id: string
  name: string
  count: number
  pct: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function fmt24(t: string | null): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h24 = parseInt(hStr ?? '0')
  const m   = mStr ?? '00'
  const ap  = h24 >= 12 ? 'pm' : 'am'
  const h12 = h24 % 12 || 12
  return m === '00' ? `${h12}${ap}` : `${h12}:${m}${ap}`
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const GOLD   = '#C9A84C'
const GREEN  = '#34d399'
const PURPLE = '#a78bfa'
const AMBER  = '#fbbf24'
const TEAL   = '#22d3ee'

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(8,12,28,0.96)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'rgba(255,255,255,0.88)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.50)',
}

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)',
  backdropFilter: 'blur(32px) saturate(180%)',
  WebkitBackdropFilter: 'blur(32px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.065)',
  borderRadius: 20,
  boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 16px 48px rgba(0,0,0,0.35)',
}

function KPI({ label, value, sub, icon: Icon, color, trend }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string; trend?: number
}) {
  const TIcon  = trend === undefined || trend === 0 ? Minus : trend > 0 ? ArrowUpRight : ArrowDownRight
  const tcolor = trend === undefined || trend === 0 ? 'rgba(255,255,255,0.28)' : trend > 0 ? GREEN : '#f87171'
  return (
    <div style={{ ...cardStyle, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.42)', margin: 0 }}>{label}</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.92)', margin: '6px 0 0', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</p>
          {sub && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', margin: '4px 0 0' }}>{sub}</p>}
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}22`, border: `1px solid ${color}33` }}>
          <Icon style={{ width: 16, height: 16, color }} strokeWidth={2} />
        </div>
      </div>
      {trend !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <TIcon style={{ width: 12, height: 12, color: tcolor, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: tcolor }}>{trend > 0 ? '+' : ''}{trend}% last 30d</span>
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CellAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: cellId } = use(params)
  const routeParams = useParams()
  const slug = routeParams?.slug as string

  const [cell,       setCell]       = useState<CellInfo | null>(null)
  const [events,     setEvents]     = useState<CellEvent[]>([])
  const [topMembers, setTopMembers] = useState<TopMember[]>([])
  const [loading,    setLoading]    = useState(true)
  const [mounted,    setMounted]    = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const sb = getSupabaseBrowser()

    async function load() {
      // 1. Church ID
      const { data: church } = await sb.from('churches').select('id').eq('slug', slug).single()
      if (!church) { setLoading(false); return }

      // 2. Cell info (with group name via joined group_name from api)
      const { data: cellData } = await sb
        .from('cells')
        .select('id, name, color, group_id, meeting_day, meeting_time, location, leader_name, groups(name)')
        .eq('id', cellId)
        .single()

      if (!cellData) { setLoading(false); return }

      const cellInfo: CellInfo = {
        id:           cellData.id,
        name:         cellData.name,
        color:        cellData.color ?? GOLD,
        group_name:   (cellData.groups as unknown as { name: string } | null)?.name ?? null,
        meeting_day:  cellData.meeting_day,
        meeting_time: cellData.meeting_time,
        location:     cellData.location,
        leader_name:  cellData.leader_name,
      }
      setCell(cellInfo)

      // 3. All events for this cell with attendance count
      const { data: evData } = await sb
        .from('events')
        .select('id, event_date, attendance(count)')
        .eq('cell_id', cellId)
        .eq('church_id', church.id)
        .order('event_date', { ascending: true })

      const evList: CellEvent[] = (evData ?? []).map((e: Record<string, unknown>) => {
        const attArr = e.attendance as { count: string }[] | null
        return {
          id: e.id as string,
          event_date: e.event_date as string,
          attendance_count: attArr && attArr.length > 0 ? parseInt(attArr[0].count) : 0,
        }
      })
      setEvents(evList)

      // 4. Top members — fetch all attendance for this cell's events
      if (evList.length > 0) {
        const eventIds = evList.map(e => e.id)
        const { data: attData } = await sb
          .from('attendance')
          .select('person_id, people(first_name, last_name)')
          .in('event_id', eventIds)
          .eq('attendance_status', 'present')

        const countMap = new Map<string, { name: string; count: number }>()
        for (const row of attData ?? []) {
          const pid  = row.person_id as string
          const p    = row.people as unknown as { first_name: string; last_name: string } | null
          const name = p ? `${p.first_name} ${p.last_name}`.trim() : 'Unknown'
          const existing = countMap.get(pid)
          if (existing) existing.count++
          else countMap.set(pid, { name, count: 1 })
        }

        const total = evList.length
        const sorted = [...countMap.entries()]
          .map(([pid, { name, count }]) => ({ person_id: pid, name, count, pct: Math.round((count / total) * 100) }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20)
        setTopMembers(sorted)
      }

      setLoading(false)
    }

    load()
  }, [slug, cellId])

  // ── Derived stats ────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!events.length) return { sessions: 0, totalAtt: 0, uniqueMembers: 0, avg: 0, trend: 0 }
    const sessions   = events.length
    const totalAtt   = events.reduce((s, e) => s + e.attendance_count, 0)
    const avg        = sessions > 0 ? Math.round((totalAtt / sessions) * 10) / 10 : 0
    const uniqueMembers = topMembers.length

    // Trend: compare last 4 sessions avg vs prior 4
    const recent = events.slice(-4)
    const prior  = events.slice(-8, -4)
    if (prior.length > 0) {
      const rAvg = recent.reduce((s, e) => s + e.attendance_count, 0) / recent.length
      const pAvg = prior.reduce((s, e) => s + e.attendance_count, 0) / prior.length
      const trend = pAvg > 0 ? Math.round(((rAvg - pAvg) / pAvg) * 100) : 0
      return { sessions, totalAtt, uniqueMembers, avg, trend }
    }
    return { sessions, totalAtt, uniqueMembers, avg, trend: 0 }
  }, [events, topMembers])

  const chartData = useMemo(() =>
    events.map(e => ({ date: e.event_date, count: e.attendance_count, label: fmtDate(e.event_date) })),
  [events])

  const recentEvents = useMemo(() => [...events].reverse().slice(0, 8), [events])

  // ── Loading skeleton ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="shimmer" style={{ height: 24, width: 120, borderRadius: 8, background: 'rgba(255,255,255,0.06)' }} />
        <div className="shimmer" style={{ height: 80, borderRadius: 20, background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[1,2,3,4].map(i => <div key={i} className="shimmer" style={{ height: 100, borderRadius: 20, background: 'rgba(255,255,255,0.04)' }} />)}
        </div>
        <div className="shimmer" style={{ height: 240, borderRadius: 20, background: 'rgba(255,255,255,0.04)' }} />
      </div>
    )
  }

  if (!cell) {
    return (
      <div style={{ padding: 24 }}>
        <Link href={`/${slug}/cells`} style={{ fontSize: 13, color: 'rgba(255,255,255,0.44)', textDecoration: 'none' }}>
          ← Cells
        </Link>
        <p style={{ marginTop: 24, color: 'rgba(255,255,255,0.44)' }}>Cell not found.</p>
      </div>
    )
  }

  const cellColor = cell.color || GOLD

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>

      {/* ── Nav ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <Link href={`/${slug}/cells`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.40)', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.70)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.40)')}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} /> Cells
        </Link>
        <Link href={`/${slug}/cells/${cellId}/edit`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, textDecoration: 'none', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)', transition: 'all 0.12s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = 'rgba(255,255,255,0.90)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)' }}
        >
          <Pencil style={{ width: 13, height: 13 }} /> Edit
        </Link>
      </div>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: cellColor, flexShrink: 0, boxShadow: `0 0 10px ${cellColor}80` }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.022em', color: 'rgba(255,255,255,0.92)', margin: 0 }}>
            {cell.name}
          </h1>
          {cell.group_name && (
            <span style={{ fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 99, background: `${cellColor}18`, border: `1px solid ${cellColor}35`, color: cellColor }}>
              {cell.group_name}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: 'rgba(255,255,255,0.38)' }}>
          {cell.meeting_day !== null && (
            <span>Every {DAY_NAMES[cell.meeting_day]}{cell.meeting_time ? ` · ${fmt24(cell.meeting_time)}` : ''}</span>
          )}
          {cell.location && <span>{cell.location}</span>}
          {cell.leader_name && <span>Led by {cell.leader_name}</span>}
        </div>
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}
        className="sm:grid-cols-4"
      >
        <KPI label="Sessions"       value={stats.sessions}      icon={CalendarDays} color={GOLD}   />
        <KPI label="Total Check-ins" value={stats.totalAtt}     icon={Users}        color={GREEN}  />
        <KPI label="Unique Members" value={stats.uniqueMembers} icon={Activity}     color={PURPLE} />
        <KPI label="Avg / Session"  value={stats.avg}           icon={TrendingUp}   color={AMBER}  trend={stats.trend} />
      </div>

      {/* ── Attendance trend chart ── */}
      {chartData.length > 0 && (
        <div style={{ ...cardStyle, padding: 24, marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.80)', margin: '0 0 4px' }}>Attendance Over Time</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', margin: '0 0 20px' }}>Check-ins per session</p>
          {mounted && (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cellGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={cellColor} stopOpacity={0.45} />
                    <stop offset="95%" stopColor={cellColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, 'Attended']} labelFormatter={l => `Session: ${l}`} />
                <Area type="monotone" dataKey="count" stroke={cellColor} fill="url(#cellGrad)" strokeWidth={2} dot={{ r: 3, fill: cellColor, stroke: 'rgba(8,12,28,0.90)', strokeWidth: 2 }} activeDot={{ r: 5, fill: cellColor }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── Two columns: top members + recent sessions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="max-sm:grid-cols-1">

        {/* Most Consistent Members */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.80)', margin: 0 }}>Most Consistent Members</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', margin: '2px 0 0' }}>Ranked by sessions attended</p>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 380, padding: '10px 0' }}>
            {topMembers.length === 0 ? (
              <p style={{ padding: '20px 20px', fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>No attendance data yet</p>
            ) : topMembers.map((m, i) => {
              const isTop = i < 3
              return (
                <Link key={m.person_id} href={`/${slug}/people/${m.person_id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px', textDecoration: 'none', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ width: 18, fontSize: 11, fontWeight: 700, textAlign: 'right', flexShrink: 0, color: isTop ? AMBER : 'rgba(255,255,255,0.20)' }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name}
                    </p>
                    <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.06)', marginTop: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, width: `${m.pct}%`, background: isTop ? AMBER : cellColor, opacity: 0.75, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isTop ? AMBER : 'rgba(255,255,255,0.75)' }}>{m.count}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginLeft: 4 }}>{m.pct}%</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Recent Sessions */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.80)', margin: 0 }}>Recent Sessions</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', margin: '2px 0 0' }}>Latest meetings</p>
          </div>
          <div style={{ padding: '10px 0' }}>
            {recentEvents.length === 0 ? (
              <p style={{ padding: '20px', fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>No sessions yet</p>
            ) : recentEvents.map((ev, i) => (
              <Link key={ev.id} href={`/${slug}/events/${ev.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', textDecoration: 'none', borderBottom: i < recentEvents.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', transition: 'background 0.12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `${cellColor}18`, border: `1px solid ${cellColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: cellColor }}>
                    {new Date(ev.event_date + 'T12:00:00').getDate()}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.82)', margin: 0 }}>
                    {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', margin: '1px 0 0' }}>
                    {ev.attendance_count} attended
                  </p>
                </div>
                <ArrowUpRight style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.18)', flexShrink: 0, transform: 'rotate(0deg)' }} />
              </Link>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  ComposedChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import {
  Users, CalendarDays, TrendingUp, Activity,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  kpis: {
    totalServices:    number
    totalAttendances: number
    uniqueAttendees:  number
    avgPerService:    number
    growthRate:       number
  }
  timeline: {
    week: string         // Sunday of that week "YYYY-MM-DD"
    total: number
    sunday_inperson: number
    sunday_online:   number
    midweek:         number
    cell:            number
  }[]
  serviceBreakdown: { type: string; label: string; count: number; sessions: number; avg: number }[]
  newVsReturning:   { new: number; returning: number }
  topAttendees:     { name: string; first_name: string; last_name: string; count: number }[]
  distribution:     { bucket: string; people: number }[]
  monthlyTrends:    { month: string; total: number; growth: number }[]
  cellBreakdown:    { cell: string; count: number; sessions: number; avg: number }[]
}

// ── Constants ──────────────────────────────────────────────────────────────────

const RANGES = [
  { value: '3m',  label: '3 Months' },
  { value: '6m',  label: '6 Months' },
  { value: '12m', label: '1 Year' },
  { value: 'all', label: 'All Time' },
]

const C = {
  blue:   '#4068E2',
  green:  '#059669',
  amber:  '#D97706',
  teal:   '#0891B2',
  purple: '#7C3AED',
  gray:   '#9CA3AF',
}

const SVC_COLOR: Record<string, string> = {
  sunday_inperson: C.blue,
  sunday_online:   C.green,
  midweek:         C.amber,
  cell:            C.teal,
  unknown:         C.gray,
}

const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  fontSize: '12px',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getRangeDates(range: string): { from: string; to: string } {
  const now  = new Date()
  const from = new Date(now)
  if      (range === '3m')  from.setMonth(now.getMonth() - 3)
  else if (range === '6m')  from.setMonth(now.getMonth() - 6)
  else if (range === 'all') from.setFullYear(now.getFullYear() - 5)
  else                      from.setFullYear(now.getFullYear() - 1)
  return {
    from: from.toISOString().split('T')[0],
    to:   now.toISOString().split('T')[0],
  }
}

const fmtWeek = (d: string) =>
  new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

// ── Reusable UI ────────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl p-5 ${className}`} style={{ border: '1px solid #E5E7EB' }}>
      {children}
    </div>
  )
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold" style={{ color: '#374151' }}>{children}</h3>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{sub}</p>}
    </div>
  )
}

function Pulse({ h = 200 }: { h?: number }) {
  return <div className="animate-pulse rounded-lg" style={{ height: h, backgroundColor: '#F3F4F6' }} />
}

function Empty({ h = 220 }: { h?: number }) {
  return (
    <div className="flex items-center justify-center rounded-lg text-sm"
      style={{ height: h, color: '#D1D5DB', backgroundColor: '#FAFAFA' }}>
      No data in this range
    </div>
  )
}

function KPICard({
  label, value, sub, icon: Icon, color = C.blue, trend,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color?: string; trend?: number
}) {
  const TrendIcon  = trend === undefined || trend === 0 ? Minus : trend > 0 ? ArrowUpRight : ArrowDownRight
  const trendColor = trend === undefined || trend === 0 ? '#9CA3AF' : trend > 0 ? C.green : '#DC2626'

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: '#6B7280' }}>{label}</p>
          <p className="text-2xl font-bold mt-1 leading-none" style={{ color: '#111827' }}>{value}</p>
          {sub && <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>{sub}</p>}
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-3 pt-3" style={{ borderTop: '1px solid #F3F4F6' }}>
          <TrendIcon className="w-3.5 h-3.5 shrink-0" style={{ color: trendColor }} />
          <span className="text-xs" style={{ color: trendColor }}>
            {trend > 0 ? '+' : ''}{trend}% vs prior 4 weeks
          </span>
        </div>
      )}
    </Card>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data,    setData]    = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [range,   setRange]   = useState('12m')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const { from, to } = getRangeDates(range)
    setLoading(true)
    setError(null)
    fetch(`/api/analytics?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [range])

  const noData = !loading && !error && (!data || data.kpis.totalServices === 0)

  return (
    <div className="p-4 md:p-8 max-w-6xl space-y-5" style={{ color: '#111827' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Analytics</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Attendance insights and congregation trends</p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl self-start sm:self-auto" style={{ backgroundColor: '#F3F4F6' }}>
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: range === r.value ? '#FFFFFF' : 'transparent',
                color:            range === r.value ? '#111827'  : '#6B7280',
                boxShadow:        range === r.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-sm"
          style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
          Error: {error}
        </div>
      )}

      {noData && (
        <Card>
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: '#F0FDF4' }}>
              <Activity className="w-6 h-6" style={{ color: C.green }} />
            </div>
            <p className="text-sm font-medium" style={{ color: '#374151' }}>No attendance data yet</p>
            <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: '#9CA3AF' }}>
              Import your Breeze and cell attendance CSVs to populate this dashboard.
            </p>
          </div>
        </Card>
      )}

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Card key={i}><Pulse h={90} /></Card>)
        ) : data ? (
          <>
            <KPICard label="Total Services"   value={data.kpis.totalServices}                     sub="incl. cells"         icon={CalendarDays} color={C.blue}   />
            <KPICard label="Total Check-ins"  value={data.kpis.totalAttendances.toLocaleString()}  sub="all service types"   icon={Users}        color={C.green}  />
            <KPICard label="Unique Attendees" value={data.kpis.uniqueAttendees}                    sub="individuals"         icon={Activity}     color={C.purple} />
            <KPICard label="Avg per Service"  value={data.kpis.avgPerService}                      sub="people / meeting"    icon={TrendingUp}   color={C.amber}  trend={data.kpis.growthRate} />
          </>
        ) : null}
      </div>

      {/* ── Weekly Attendance — stacked area by service type ───────────────── */}
      {!noData && (
        <Card>
          <SectionTitle
            sub="Each point = one week (Sunday–Saturday). All service types in the same week are stacked together."
          >
            Weekly Attendance by Service Type
          </SectionTitle>
          {loading || !mounted ? <Pulse h={300} /> : data?.timeline.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.timeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  {([
                    ['sunday_inperson', C.blue],
                    ['sunday_online',   C.green],
                    ['midweek',         C.amber],
                    ['cell',            C.teal],
                  ] as [string, string][]).map(([key, color]) => (
                    <linearGradient key={key} id={`g-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.03} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="week"
                  tickFormatter={fmtWeek}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(l) => `Week of ${typeof l === 'string' ? fmtWeek(l) : l}`}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                <Area stackId="a" type="monotone" dataKey="sunday_inperson" name="Sunday In-Person" stroke={C.blue}  fill={`url(#g-sunday_inperson)`} strokeWidth={1.5} dot={false} />
                <Area stackId="a" type="monotone" dataKey="sunday_online"   name="Sunday Online"   stroke={C.green} fill={`url(#g-sunday_online)`}   strokeWidth={1.5} dot={false} />
                <Area stackId="a" type="monotone" dataKey="midweek"         name="Midweek"         stroke={C.amber} fill={`url(#g-midweek)`}         strokeWidth={1.5} dot={false} />
                <Area stackId="a" type="monotone" dataKey="cell"            name="Cell Meetings"   stroke={C.teal}  fill={`url(#g-cell)`}            strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty h={300} />}
        </Card>
      )}

      {/* ── Service Breakdown + New vs Returning ───────────────────────────── */}
      {!noData && (
        <div className="grid md:grid-cols-2 gap-5">

          {/* Service breakdown */}
          <Card>
            <SectionTitle>Total Attendance by Service Type</SectionTitle>
            {loading || !mounted ? <Pulse h={220} /> : data?.serviceBreakdown.length ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={data.serviceBreakdown}
                    layout="vertical"
                    margin={{ top: 0, right: 12, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis
                      dataKey="label"
                      type="category"
                      width={120}
                      tick={{ fontSize: 11, fill: '#374151' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v, 'Total attendances']} />
                    <Bar dataKey="count" name="Attendances" radius={[0, 4, 4, 0]}>
                      {data.serviceBreakdown.map(e => <Cell key={e.type} fill={SVC_COLOR[e.type] ?? C.gray} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Stats row */}
                <div
                  className="mt-3 pt-3 grid gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(data.serviceBreakdown.length, 4)}, 1fr)`,
                    borderTop: '1px solid #F3F4F6',
                  }}
                >
                  {data.serviceBreakdown.map(s => (
                    <div key={s.type} className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: SVC_COLOR[s.type] ?? C.gray }} />
                        <span className="text-[10px] font-medium truncate" style={{ color: '#9CA3AF' }}>{s.label.split(' ')[0]}</span>
                      </div>
                      <div className="text-sm font-bold" style={{ color: '#111827' }}>{s.sessions}</div>
                      <div className="text-[10px]" style={{ color: '#6B7280' }}>avg {s.avg}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : <Empty />}
          </Card>

          {/* New vs Returning */}
          <Card>
            <SectionTitle sub="New = no prior attendance before selected period">
              New vs Returning Attendees
            </SectionTitle>
            {loading || !mounted ? <Pulse h={220} /> : data ? (() => {
              const total = data.newVsReturning.new + data.newVsReturning.returning
              const items = [
                { label: 'Returning',   value: data.newVsReturning.returning, color: C.blue },
                { label: 'First-Timer', value: data.newVsReturning.new,       color: C.green },
              ]
              return (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={items}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={84}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="label"
                      >
                        {items.map(item => <Cell key={item.label} fill={item.color} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-8 mt-2">
                    {items.map(item => (
                      <div key={item.label} className="text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-xs" style={{ color: '#6B7280' }}>{item.label}</span>
                        </div>
                        <div className="text-xl font-bold" style={{ color: '#111827' }}>{item.value}</div>
                        <div className="text-xs" style={{ color: '#9CA3AF' }}>
                          {total > 0 ? Math.round((item.value / total) * 100) : 0}%
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            })() : null}
          </Card>
        </div>
      )}

      {/* ── Cell Meeting Breakdown ──────────────────────────────────────────── */}
      {!noData && (
        <div className="grid md:grid-cols-2 gap-5">

          {/* Cell attendance bar chart */}
          <Card>
            <SectionTitle sub="Total attendance per cell group">Cell Attendance Breakdown</SectionTitle>
            {loading || !mounted ? <Pulse h={260} /> : data?.cellBreakdown.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={data.cellBreakdown}
                  layout="vertical"
                  margin={{ top: 0, right: 12, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis
                    dataKey="cell"
                    type="category"
                    width={150}
                    tick={{ fontSize: 10, fill: '#374151' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v, name) => [v, name === 'count' ? 'Total attendances' : name]}
                    labelFormatter={l => `${l}`}
                  />
                  <Bar dataKey="count" name="Attendances" fill={C.teal} radius={[0, 4, 4, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty h={260} />
            )}
          </Card>

          {/* Cell league table */}
          <Card>
            <SectionTitle sub="Ranked by total check-ins">Top Cell Groups</SectionTitle>
            {loading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="animate-pulse h-9 rounded-lg" style={{ backgroundColor: '#F3F4F6' }} />
                ))}
              </div>
            ) : data?.cellBreakdown.length ? (
              <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 280 }}>
                {data.cellBreakdown.map((c, i) => {
                  const max  = data.cellBreakdown[0]?.count ?? 1
                  const pct  = Math.round((c.count / max) * 100)
                  const isTop = i < 3
                  return (
                    <div key={c.cell} className="flex items-center gap-2.5">
                      <span className="w-5 text-xs font-semibold text-right shrink-0"
                        style={{ color: isTop ? C.amber : '#D1D5DB' }}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium truncate" style={{ color: '#111827' }}>
                            {c.cell}
                          </span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-[10px]" style={{ color: '#9CA3AF' }}>{c.sessions} sessions · avg {c.avg}</span>
                            <span className="text-xs font-bold" style={{ color: isTop ? C.amber : C.teal }}>
                              {c.count}×
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ backgroundColor: '#F3F4F6' }}>
                          <div className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: isTop ? C.amber : C.teal, opacity: 0.75 }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <Empty />}
          </Card>
        </div>
      )}

      {/* ── Monthly Trends ──────────────────────────────────────────────────── */}
      {!noData && (
        <Card>
          <SectionTitle sub="Bars = total attendance (all services) · Line = month-over-month growth %">
            Monthly Attendance Trends
          </SectionTitle>
          {loading || !mounted ? <Pulse h={260} /> : data?.monthlyTrends.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={data.monthlyTrends} margin={{ top: 4, right: 28, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => name === 'Growth %' ? [`${v}%`, name] : [v, name]} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar  yAxisId="l" dataKey="total"  name="Attendance" fill={C.blue}  radius={[4, 4, 0, 0]} opacity={0.85} />
                <Line yAxisId="r" type="monotone" dataKey="growth" name="Growth %" stroke={C.green} strokeWidth={2} dot={{ r: 3, fill: C.green }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <Empty h={260} />}
        </Card>
      )}

      {/* ── Distribution + Top Attendees ────────────────────────────────────── */}
      {!noData && (
        <div className="grid md:grid-cols-2 gap-5">

          <Card>
            <SectionTitle sub="How frequently individuals attend (all service types combined)">
              Attendance Distribution
            </SectionTitle>
            {loading || !mounted ? <Pulse h={220} /> : data?.distribution.length ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.distribution} margin={{ top: 0, right: 4, left: -24, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: 'Times Attended', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#9CA3AF' }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelFormatter={l => `Attended ${l} times`}
                      formatter={v => [v, 'People']}
                    />
                    <Bar dataKey="people" name="People" fill={C.purple} radius={[4, 4, 0, 0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 pt-3 flex gap-5 text-xs" style={{ borderTop: '1px solid #F3F4F6' }}>
                  <div>
                    <span style={{ color: '#9CA3AF' }}>One-timers: </span>
                    <span className="font-semibold" style={{ color: '#111827' }}>
                      {data.distribution.find(d => d.bucket === '1')?.people ?? 0}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#9CA3AF' }}>Regulars (7+×): </span>
                    <span className="font-semibold" style={{ color: '#111827' }}>
                      {data.distribution.filter(d => ['7–10', '11–20', '21+'].includes(d.bucket)).reduce((s, d) => s + d.people, 0)}
                    </span>
                  </div>
                </div>
              </>
            ) : <Empty />}
          </Card>

          <Card>
            <SectionTitle sub="Ranked by total services attended (all types)">Top Attendees</SectionTitle>
            {loading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="animate-pulse h-8 rounded-lg" style={{ backgroundColor: '#F3F4F6' }} />
                ))}
              </div>
            ) : data?.topAttendees.length ? (
              <div className="space-y-2 overflow-y-auto pr-0.5" style={{ maxHeight: 300 }}>
                {data.topAttendees.map((p, i) => {
                  const max   = data.topAttendees[0]?.count ?? 1
                  const pct   = Math.round((p.count / max) * 100)
                  const isTop = i < 3
                  const displayName = [p.first_name || p.name.split(' ')[0], p.last_name].filter(Boolean).join(' ')
                  return (
                    <div key={i} className="flex items-center gap-2.5">
                      <span className="w-5 text-xs font-semibold text-right shrink-0"
                        style={{ color: isTop ? C.amber : '#D1D5DB' }}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium truncate" style={{ color: '#111827' }}>
                            {displayName}
                          </span>
                          <span className="text-xs font-bold shrink-0 ml-2"
                            style={{ color: isTop ? C.amber : C.blue }}>
                            {p.count}×
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ backgroundColor: '#F3F4F6' }}>
                          <div className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: isTop ? C.amber : C.blue, opacity: 0.75 }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <Empty />}
          </Card>
        </div>
      )}

      <div className="h-2" />
    </div>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  ComposedChart, Line,
  LineChart,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import {
  Users, CalendarDays, TrendingUp, Activity,
  ArrowUpRight, ArrowDownRight, Minus,
  Sparkles, Send, ChevronRight,
  RefreshCw, BarChart2,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface WeeklyCell {
  cellName: string; groupName: string
  attThis: number; attLast: number
  soulWon: number; fsEnrolled: number; substantiations: number; firstTimers: number
}
interface WeeklyGroup {
  groupName: string
  cellAttThis: number; cellAttLast: number
  sundayAttThis: number; sundayAttLast: number
  sunFirstTimersThis: number; sunFirstTimersLast: number
  wedAttThis: number; wedAttLast: number
  soulWonThis: number; soulWonLast: number
  soulTracker: number
  uniqueThis: number; uniqueLast: number
}

interface AnalyticsData {
  kpis: { totalMeetings: number; totalAttendance: number; uniqueAttendees: number; avgPerMeeting: number; growthRate: number }
  timeline:       ({ week: string; total: number } & Record<string, number>)[]
  monthlyTrends:  { month: string; total: number; growth: number }[]
  sundayTimeline: ({ week: string } & Record<string, number>)[]
  sundayGroups:   string[]
  groups:         { name: string; meetings: number; totalAttendance: number; uniqueAttendees: number; avgPerMeeting: number }[]
  cells:          { name: string; group: string; sessions: number; total: number; avg: number }[]
  newVsReturning: { new: number; returning: number }
  distribution:   { bucket: string; people: number }[]
  retention:      { active: number; lapsing: number; lapsed: number }
  topAttendees:   { name: string; times: number }[]
  weekly: {
    range: { thisWeek: { start: string; end: string }; lastWeek: { start: string; end: string } }
    cells:  WeeklyCell[]
    groups: WeeklyGroup[]
  }
}

interface ChartConfig {
  type: 'bar' | 'horizontal_bar' | 'line' | 'area' | 'pie' | 'table'
  title: string
  description: string
  xKey: string
  yKeys: { key: string; label: string; color: string }[]
}

interface AIResult {
  chart: ChartConfig
  data:  Record<string, unknown>[]
  insight: string
  sql: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const RANGES = [
  { value: '3m',  label: '3M' },
  { value: '6m',  label: '6M' },
  { value: '12m', label: '1Y' },
  { value: 'all', label: 'All' },
]

const C = {
  indigo: '#C9A84C',
  green:  '#34d399',
  amber:  '#fbbf24',
  teal:   '#22d3ee',
  purple: '#a78bfa',
  red:    '#f87171',
  gray:   '#6b7280',
  pink:   '#f472b6',
  blue:   '#60a5fa',
}

const GROUP_PALETTE = [C.indigo, C.green, C.amber, C.teal, C.purple, C.pink, C.blue, C.red]
function groupColor(name: string): string {
  let h = 0
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return GROUP_PALETTE[Math.abs(h) % GROUP_PALETTE.length]
}

const TYPE_COLORS: Record<string, string> = {
  Sunday:     C.indigo,
  Wednesday:  C.amber,
  Cell:       C.teal,
  Prayer:     C.purple,
  Leadership: C.green,
  Special:    C.pink,
  Other:      C.gray,
}

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--aq-base)',
  border: '0.5px solid var(--aq-border)',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'var(--aq-text-primary)',
}

const GRID_STROKE = 'rgba(255,255,255,0.05)'
const TICK_FILL   = 'rgba(255,255,255,0.35)'

const PRESET_QUESTIONS = [
  'Which cells are growing fastest?',
  'Show Sunday attendance trend by group',
  'Compare cell health across all groups',
  'Who are the most consistent attendees?',
  'Which members attended less than twice in the last 60 days?',
  'Show month-over-month growth for each group',
]

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

function GlassCard({ children, className = '', style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties
}) {
  return (
    <div
      className={`${className}`}
      style={{
        background: 'var(--aq-surface)',
        border: '0.5px solid var(--aq-border)',
        borderRadius: '18px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function CardPad({ children, className = '', style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties
}) {
  return <GlassCard className={`p-5 ${className}`} style={style}>{children}</GlassCard>
}

function ChartTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <p className="text-sm font-medium" style={{ color: 'var(--aq-text-primary)' }}>{children}</p>
      {sub && <p className="text-[11px] mt-0.5" style={{ color: 'var(--aq-text-tertiary)' }}>{sub}</p>}
    </div>
  )
}

function Pulse({ h = 200 }: { h?: number }) {
  return (
    <div
      className="rounded-xl shimmer"
      style={{ height: h, background: 'var(--aq-surface)' }}
    />
  )
}

function Empty({ h = 180, label = 'No data in this range' }: { h?: number; label?: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl text-xs"
      style={{
        height: h,
        color: 'var(--aq-text-muted)',
        background: 'var(--aq-surface)',
        border: '0.5px dashed var(--aq-border)',
      }}
    >
      {label}
    </div>
  )
}

function KPICard({ label, value, sub, icon: Icon, color = C.indigo, trend }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color?: string; trend?: number
}) {
  const TrendIcon  = trend === undefined || trend === 0 ? Minus : trend > 0 ? ArrowUpRight : ArrowDownRight
  const trendColor = trend === undefined || trend === 0
    ? 'var(--aq-text-muted)'
    : trend > 0 ? 'var(--aq-sage)' : 'var(--aq-rose)'
  return (
    <GlassCard className="p-5 glass-hover" style={{ transition: 'transform 0.2s, border-color 0.2s' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium" style={{ color: 'var(--aq-text-tertiary)' }}>{label}</p>
          <p
            className="text-2xl font-medium mt-1.5 leading-none tracking-tight"
            style={{ color: 'var(--aq-text-primary)' }}
          >
            {value}
          </p>
          {sub && <p className="text-[11px] mt-1" style={{ color: 'var(--aq-text-tertiary)' }}>{sub}</p>}
        </div>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}22`, border: `1px solid ${color}33` }}
        >
          <Icon className="w-4 h-4" style={{ color }} strokeWidth={2} />
        </div>
      </div>
      {trend !== undefined && (
        <div
          className="flex items-center gap-1 mt-3 pt-3"
          style={{ borderTop: '0.5px solid var(--aq-border)' }}
        >
          <TrendIcon className="w-3.5 h-3.5 shrink-0" style={{ color: trendColor }} />
          <span className="text-[11px]" style={{ color: trendColor }}>
            {trend > 0 ? '+' : ''}{trend}% vs prior 4 weeks
          </span>
        </div>
      )}
    </GlassCard>
  )
}

// ── Dynamic AI chart renderer ──────────────────────────────────────────────────

function DynamicChart({ config, data }: { config: ChartConfig; data: Record<string, unknown>[] }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted || !data.length) return <Empty h={260} label="No results" />

  const { type, xKey, yKeys } = config

  if (type === 'table') {
    const cols = Object.keys(data[0])
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ borderBottom: '0.5px solid var(--aq-border)' }}>
              {cols.map(c => (
                <th key={c} className="text-left py-2 pr-4 font-medium"
                  style={{ color: 'var(--aq-text-tertiary)' }}>
                  {c.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} style={{ borderBottom: '0.5px solid var(--aq-border)' }}>
                {cols.map(c => (
                  <td key={c} className="py-2 pr-4" style={{ color: 'var(--aq-text-primary)' }}>
                    {String(row[c] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (type === 'pie') {
    const key = yKeys[0]?.key ?? 'value'
    const items = data.map((r, i) => ({
      name:  String(r[xKey] ?? `Item ${i + 1}`),
      value: Number(r[key] ?? 0),
      color: yKeys[i]?.color ?? [C.indigo, C.green, C.amber, C.teal, C.purple, C.pink][i % 6],
    }))
    const total = items.reduce((s, x) => s + x.value, 0)
    return (
      <div className="flex flex-col items-center gap-4">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={items} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
              paddingAngle={3} dataKey="value" nameKey="name">
              {items.map(item => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          {items.map(item => (
            <div key={item.name} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-xs" style={{ color: 'var(--aq-text-secondary)' }}>{item.name}</span>
              <span className="text-xs font-medium" style={{ color: 'var(--aq-text-primary)' }}>
                {item.value} ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'horizontal_bar') {
    return (
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
          <YAxis dataKey={xKey} type="category" width={160}
            tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {yKeys.map(yk => (
            <Bar key={yk.key} dataKey={yk.key} name={yk.label} fill={yk.color}
              radius={[0, 4, 4, 0]} opacity={0.85} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: TICK_FILL }} />}
          {yKeys.map(yk => (
            <Bar key={yk.key} dataKey={yk.key} name={yk.label} fill={yk.color}
              radius={[4, 4, 0, 0]} opacity={0.85} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <defs>
            {yKeys.map(yk => (
              <linearGradient key={yk.key} id={`ai-g-${yk.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={yk.color} stopOpacity={0.40} />
                <stop offset="95%" stopColor={yk.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: TICK_FILL }} />}
          {yKeys.map(yk => (
            <Area key={yk.key} type="monotone" dataKey={yk.key} name={yk.label}
              stroke={yk.color} fill={`url(#ai-g-${yk.key})`}
              strokeWidth={2} dot={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: TICK_FILL }} />}
        {yKeys.map(yk => (
          <Line key={yk.key} type="monotone" dataKey={yk.key} name={yk.label}
            stroke={yk.color} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: yk.color }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Weekly Report ─────────────────────────────────────────────────────────

function fmtDateRange(start: string, end: string) {
  const s = new Date(start + 'T12:00:00Z')
  const e = new Date(end   + 'T12:00:00Z')
  const mo = s.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  const sd = s.getUTCDate()
  const ed = e.getUTCDate()
  const emo = e.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  return mo === emo ? `${mo} ${sd}–${ed}` : `${mo} ${sd} – ${emo} ${ed}`
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  const diff = cur - prev
  if (prev === 0 && cur === 0) return <span style={{ color: 'var(--aq-text-muted)' }}>—</span>
  const up = diff >= 0
  return (
    <span style={{ color: up ? 'var(--aq-sage)' : 'var(--aq-rose)', fontSize: '10px', marginLeft: '4px' }}>
      {up ? '▲' : '▼'}{Math.abs(diff)}
    </span>
  )
}

function WeeklyReport({
  weekly,
  loading,
}: {
  weekly: AnalyticsData['weekly']
  loading: boolean
}) {
  const { range, cells, groups } = weekly
  const tw = fmtDateRange(range.thisWeek.start, range.thisWeek.end)
  const lw = fmtDateRange(range.lastWeek.start, range.lastWeek.end)

  const thStyle: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: '10px',
    fontWeight: 500,
    color: 'var(--aq-text-tertiary)',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    borderBottom: '0.5px solid var(--aq-border)',
  }
  const tdStyle: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: '12px',
    color: 'var(--aq-text-primary)',
    borderBottom: '0.5px solid var(--aq-border)',
    whiteSpace: 'nowrap',
  }
  const numTd: React.CSSProperties = { ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <div
          className="w-1 h-5 rounded-full"
          style={{ background: 'var(--aq-gold)' }}
        />
        <h2 className="text-sm font-medium" style={{ color: 'var(--aq-text-primary)' }}>
          Weekly Report
        </h2>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(200,169,107,0.14)', color: 'var(--aq-gold)', border: '0.5px solid var(--aq-border)' }}
        >
          {tw}
        </span>
        <span className="text-xs" style={{ color: 'var(--aq-text-muted)' }}>vs {lw}</span>
      </div>

      {/* Group summary table */}
      <CardPad style={{ padding: 0, overflow: 'hidden' }}>
        <div className="px-5 pt-4 pb-3" style={{ borderBottom: '0.5px solid var(--aq-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--aq-text-primary)' }}>Group Summary</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--aq-text-tertiary)' }}>
            This week vs last week · arrows show change
          </p>
        </div>
        {loading ? (
          <div className="p-5"><Pulse h={120} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 780 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, paddingLeft: 20 }}>Group</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Cell Att<br /><span style={{ fontWeight: 400 }}>this / last</span></th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Sunday Att<br /><span style={{ fontWeight: 400 }}>this / last</span></th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Sun 1st Timers<br /><span style={{ fontWeight: 400 }}>this / last</span></th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Wed Att<br /><span style={{ fontWeight: 400 }}>this / last</span></th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Soul Won<br /><span style={{ fontWeight: 400 }}>this / last</span></th>
                  <th style={{ ...thStyle, textAlign: 'right', paddingRight: 20 }}>Unique<br /><span style={{ fontWeight: 400 }}>this / last</span></th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', padding: '24px', color: 'var(--aq-text-muted)' }}>
                      No group data for this week
                    </td>
                  </tr>
                ) : groups.map(g => (
                  <tr key={g.groupName}
                    className="transition-colors"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--aq-surface)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...tdStyle, paddingLeft: 20 }}>
                      <span className="font-medium" style={{ color: groupColor(g.groupName) }}>
                        {g.groupName}
                      </span>
                    </td>
                    <td style={numTd}>
                      <span className="font-medium">{g.cellAttThis}</span>
                      <Delta cur={g.cellAttThis} prev={g.cellAttLast} />
                      <span style={{ color: 'var(--aq-text-muted)', marginLeft: 4 }}>/ {g.cellAttLast}</span>
                    </td>
                    <td style={numTd}>
                      <span className="font-medium">{g.sundayAttThis}</span>
                      <Delta cur={g.sundayAttThis} prev={g.sundayAttLast} />
                      <span style={{ color: 'var(--aq-text-muted)', marginLeft: 4 }}>/ {g.sundayAttLast}</span>
                    </td>
                    <td style={numTd}>
                      <span className="font-medium">{g.sunFirstTimersThis}</span>
                      <Delta cur={g.sunFirstTimersThis} prev={g.sunFirstTimersLast} />
                      <span style={{ color: 'var(--aq-text-muted)', marginLeft: 4 }}>/ {g.sunFirstTimersLast}</span>
                    </td>
                    <td style={numTd}>
                      <span className="font-medium">{g.wedAttThis}</span>
                      <Delta cur={g.wedAttThis} prev={g.wedAttLast} />
                      <span style={{ color: 'var(--aq-text-muted)', marginLeft: 4 }}>/ {g.wedAttLast}</span>
                    </td>
                    <td style={numTd}>
                      <span className="font-medium" style={{ color: g.soulWonThis > 0 ? 'var(--aq-sage)' : undefined }}>
                        {g.soulWonThis}
                      </span>
                      <Delta cur={g.soulWonThis} prev={g.soulWonLast} />
                      <span style={{ color: 'var(--aq-text-muted)', marginLeft: 4 }}>/ {g.soulWonLast}</span>
                    </td>
                    <td style={{ ...numTd, paddingRight: 20 }}>
                      <span className="font-medium">{g.uniqueThis}</span>
                      <Delta cur={g.uniqueThis} prev={g.uniqueLast} />
                      <span style={{ color: 'var(--aq-text-muted)', marginLeft: 4 }}>/ {g.uniqueLast}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardPad>

      {/* Cell detail table */}
      <CardPad style={{ padding: 0, overflow: 'hidden' }}>
        <div className="px-5 pt-4 pb-3" style={{ borderBottom: '0.5px solid var(--aq-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--aq-text-primary)' }}>Cell Detail</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--aq-text-tertiary)' }}>
            Per-cell metrics for the reported week
          </p>
        </div>
        {loading ? (
          <div className="p-5"><Pulse h={160} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 680 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, paddingLeft: 20 }}>Cell</th>
                  <th style={thStyle}>Group</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Att This</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Att Last</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Soul Won</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>FS Enrolled</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Substantiations</th>
                  <th style={{ ...thStyle, textAlign: 'right', paddingRight: 20 }}>1st Timers</th>
                </tr>
              </thead>
              <tbody>
                {cells.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', padding: '24px', color: 'var(--aq-text-muted)' }}>
                      No cell meetings this week
                    </td>
                  </tr>
                ) : cells.map((c, i) => (
                  <tr key={i}
                    className="transition-colors"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--aq-surface)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...tdStyle, paddingLeft: 20, fontWeight: 500 }}>{c.cellName}</td>
                    <td style={{ ...tdStyle, fontSize: '11px', color: groupColor(c.groupName) }}>
                      {c.groupName}
                    </td>
                    <td style={numTd}>
                      <span className="font-medium">{c.attThis}</span>
                      <Delta cur={c.attThis} prev={c.attLast} />
                    </td>
                    <td style={{ ...numTd, color: 'var(--aq-text-tertiary)' }}>{c.attLast}</td>
                    <td style={{ ...numTd, color: c.soulWon > 0 ? 'var(--aq-sage)' : undefined }}>{c.soulWon}</td>
                    <td style={{ ...numTd, color: c.fsEnrolled > 0 ? C.teal : undefined }}>{c.fsEnrolled}</td>
                    <td style={{ ...numTd, color: c.substantiations > 0 ? C.purple : undefined }}>{c.substantiations}</td>
                    <td style={{ ...numTd, paddingRight: 20 }}>{c.firstTimers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardPad>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data,    setData]    = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [range,   setRange]   = useState('12m')
  const [group,   setGroup]   = useState('all')
  const [mounted, setMounted] = useState(false)

  const [aiPrompt,   setAiPrompt]   = useState('')
  const [aiLoading,  setAiLoading]  = useState(false)
  const [aiResult,   setAiResult]   = useState<AIResult | null>(null)
  const [aiError,    setAiError]    = useState<string | null>(null)
  const [showSql,    setShowSql]    = useState(false)
  const aiRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const { from, to } = getRangeDates(range)
    const gParam = group !== 'all' ? `&group=${encodeURIComponent(group)}` : ''
    setLoading(true)
    setError(null)
    fetch(`/api/analytics?from=${from}&to=${to}${gParam}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [range, group])

  const submitAI = useCallback(async (prompt: string) => {
    if (!prompt.trim()) return
    setAiLoading(true)
    setAiError(null)
    setAiResult(null)
    setShowSql(false)
    setAiPrompt(prompt)
    setTimeout(() => aiRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    try {
      const r = await fetch('/api/analytics/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const d = await r.json() as AIResult & { error?: string }
      if (d.error) setAiError(d.error)
      else setAiResult(d)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setAiLoading(false)
    }
  }, [])

  const noData = !loading && !error && (!data || data.kpis.totalMeetings === 0)
  const groups = data?.groups.filter(g => g.totalAttendance > 0).map(g => g.name) ?? []

  // Filter pill styles
  const pill = (active: boolean) => ({
    background: active ? 'rgba(200,169,107,0.22)' : 'transparent',
    border: active ? '0.5px solid var(--aq-border)' : '0.5px solid transparent',
    color:   active ? 'var(--aq-gold)' : 'var(--aq-text-tertiary)',
    borderRadius: '10px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: active ? '500' : '500',
    transition: 'all 0.2s',
    cursor: 'pointer',
  })

  return (
    <div className="p-4 md:p-8 space-y-8" style={{ maxWidth: '1280px' }}>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight" style={{ color: 'var(--aq-text-primary)' }}>
            Analytics
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--aq-text-tertiary)' }}>
            Ministry health, attendance trends, and member engagement
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Group filter */}
          <div
            className="flex gap-0.5 p-1 rounded-xl"
            style={{ background: 'var(--aq-elevated)', border: '0.5px solid var(--aq-border)' }}
          >
            {['all', ...groups].map(g => (
              <button key={g} onClick={() => setGroup(g)} style={pill(group === g)}>
                {g === 'all' ? 'All' : g}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div
            className="flex gap-0.5 p-1 rounded-xl"
            style={{ background: 'var(--aq-elevated)', border: '0.5px solid var(--aq-border)' }}
          >
            {RANGES.map(r => (
              <button key={r.value} onClick={() => setRange(r.value)} style={pill(range === r.value)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(194,95,95,0.10)', color: 'var(--aq-rose)', border: '0.5px solid rgba(194,95,95,0.20)' }}
        >
          {error}
        </div>
      )}

      {noData && (
        <CardPad>
          <div className="text-center py-14">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(200,169,107,0.12)', border: '0.5px solid var(--aq-border)' }}
            >
              <BarChart2 className="w-7 h-7" style={{ color: 'var(--aq-gold)' }} />
            </div>
            <p className="font-medium" style={{ color: 'var(--aq-text-primary)' }}>
              No attendance data in this range
            </p>
            <p className="text-sm mt-1 max-w-xs mx-auto" style={{ color: 'var(--aq-text-tertiary)' }}>
              Import attendance files or adjust the date range to see data.
            </p>
          </div>
        </CardPad>
      )}

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <GlassCard key={i} className="p-5"><Pulse h={80} /></GlassCard>
          ))
        ) : data ? (
          <>
            <KPICard label="Total Meetings"   value={data.kpis.totalMeetings}                      sub="all types"        icon={CalendarDays} color={C.indigo}  />
            <KPICard label="Total Check-ins"  value={data.kpis.totalAttendance.toLocaleString()}   sub="all services"     icon={Users}        color={C.green}   />
            <KPICard label="Unique Members"   value={data.kpis.uniqueAttendees}                    sub="individuals"      icon={Activity}     color={C.purple}  />
            <KPICard label="Avg / Meeting"    value={data.kpis.avgPerMeeting}                      sub="people / meeting" icon={TrendingUp}   color={C.amber}   trend={data.kpis.growthRate} />
            <KPICard label="Active (30d)"     value={data.retention.active}                        sub={`${data.retention.lapsing} lapsing`} icon={ArrowUpRight} color={C.teal} />
          </>
        ) : null}
      </div>

      {/* ── Weekly Report ───────────────────────────────────────────────── */}
      {data?.weekly && (
        <WeeklyReport weekly={data.weekly} loading={loading} />
      )}

      {/* ── Attendance trend ─────────────────────────────────────────────── */}
      {!noData && (
        <CardPad>
          <ChartTitle sub="Weekly attendance stacked by service type — hover to see breakdown">
            Attendance Trend by Service Type
          </ChartTitle>
          {loading || !mounted ? <Pulse h={300} /> : data?.timeline.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.timeline} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  {Object.entries(TYPE_COLORS).map(([type, color]) => (
                    <linearGradient key={type} id={`tg-${type}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={color} stopOpacity={0.45} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="week" tickFormatter={fmtWeek}
                  tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false}
                  interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(l) => `Week of ${typeof l === 'string' ? fmtWeek(l) : l}`} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px', color: TICK_FILL }} />
                {['Sunday','Wednesday','Cell','Prayer','Leadership','Special'].map(type => (
                  <Area key={type} stackId="a" type="monotone" dataKey={type} name={type}
                    stroke={TYPE_COLORS[type]} fill={`url(#tg-${type})`}
                    strokeWidth={1.5} dot={false} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty h={300} />}
        </CardPad>
      )}

      {/* ── Group comparison + Sunday group trend ────────────────────────── */}
      {!noData && (
        <div className="grid md:grid-cols-2 gap-5">

          <CardPad>
            <ChartTitle sub="Total attendance per ministry group in selected period">
              Group Comparison
            </ChartTitle>
            {loading || !mounted ? <Pulse h={240} /> : data?.groups.length ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.groups} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="totalAttendance" name="Check-ins" radius={[6, 6, 0, 0]}>
                      {data.groups.map(g => <Cell key={g.name} fill={groupColor(g.name)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div
                  className="grid gap-2 mt-3 pt-3"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(data.groups.length, 3)}, 1fr)`,
                    borderTop: '0.5px solid var(--aq-border)',
                  }}
                >
                  {data.groups.map(g => (
                    <div
                      key={g.name}
                      className="rounded-xl p-3 text-center"
                      style={{ background: `${groupColor(g.name)}14` }}
                    >
                      <div className="text-xs font-medium truncate mb-1"
                        style={{ color: groupColor(g.name) }}>
                        {g.name}
                      </div>
                      <div className="text-lg font-medium" style={{ color: 'var(--aq-text-primary)' }}>
                        {g.totalAttendance.toLocaleString()}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--aq-text-tertiary)' }}>
                        {g.meetings} meetings · avg {g.avgPerMeeting}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : <Empty h={240} />}
          </CardPad>

          <CardPad>
            <ChartTitle sub="Weekly Sunday service headcount per group">
              Sunday Attendance by Group
            </ChartTitle>
            {loading || !mounted ? <Pulse h={240} /> : data?.sundayTimeline.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.sundayTimeline} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis dataKey="week" tickFormatter={fmtWeek}
                    tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false}
                    interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(l) => `Week of ${typeof l === 'string' ? fmtWeek(l) : l}`} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: TICK_FILL }} />
                  {(data.sundayGroups ?? groups).map(g => (
                    <Line key={g} type="monotone" dataKey={g} name={g}
                      stroke={groupColor(g)} strokeWidth={2}
                      dot={false} activeDot={{ r: 4, fill: groupColor(g) }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : <Empty h={240} label="No Sunday meetings in range" />}
          </CardPad>
        </div>
      )}

      {/* ── Cell health ──────────────────────────────────────────────────── */}
      {!noData && (
        <div className="grid md:grid-cols-2 gap-5">

          <CardPad>
            <ChartTitle sub="Total attendance per cell group (all sessions combined)">
              Cell Attendance
            </ChartTitle>
            {loading || !mounted ? <Pulse h={320} /> : data?.cells.length ? (
              <ResponsiveContainer width="100%" height={Math.max(260, Math.min(data.cells.length, 15) * 28)}>
                <BarChart data={data.cells.slice(0, 15)} layout="vertical"
                  margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={155}
                    tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE}
                    formatter={(v, name) => [v, name === 'total' ? 'Total check-ins' : String(name)]} />
                  <Bar dataKey="total" name="total" radius={[0, 4, 4, 0]}>
                    {data.cells.slice(0, 15).map(c => (
                      <Cell key={c.name} fill={groupColor(c.group)} opacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty h={260} label="No cell meetings in range" />}
          </CardPad>

          <CardPad>
            <ChartTitle sub="Ranked by total check-ins — avg shows per-session health">
              Cell Rankings
            </ChartTitle>
            {loading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-xl shimmer" style={{ background: 'var(--aq-surface)' }} />
                ))}
              </div>
            ) : data?.cells.length ? (
              <div className="space-y-2 overflow-y-auto pr-0.5" style={{ maxHeight: 340 }}>
                {data.cells.map((c, i) => {
                  const max = data.cells[0]?.total ?? 1
                  const pct = Math.round((c.total / max) * 100)
                  const top = i < 3
                  const col = groupColor(c.group)
                  return (
                    <div key={c.name} className="flex items-center gap-2.5">
                      <span className="w-5 text-xs font-medium text-right shrink-0"
                        style={{ color: top ? 'var(--aq-amber)' : 'var(--aq-text-muted)' }}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium truncate" style={{ color: 'var(--aq-text-primary)' }}>
                            {c.name}
                          </span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-[10px]" style={{ color: 'var(--aq-text-tertiary)' }}>
                              {c.sessions}× · avg {c.avg}
                            </span>
                            <span className="text-xs font-medium" style={{ color: top ? 'var(--aq-amber)' : col }}>
                              {c.total}
                            </span>
                          </div>
                        </div>
                        <div
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{ background: 'var(--aq-surface)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: top ? C.amber : col, opacity: 0.75 }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <Empty />}
          </CardPad>
        </div>
      )}

      {/* ── Engagement metrics row ───────────────────────────────────────── */}
      {!noData && (
        <div className="grid md:grid-cols-3 gap-5">

          {/* New vs Returning */}
          <CardPad>
            <ChartTitle sub="First-time vs repeat attendees in period">
              New vs Returning
            </ChartTitle>
            {loading || !mounted ? <Pulse h={200} /> : data ? (() => {
              const total = data.newVsReturning.new + data.newVsReturning.returning
              const items = [
                { label: 'Returning',    value: data.newVsReturning.returning, color: 'var(--aq-gold)' },
                { label: 'First-Timers', value: data.newVsReturning.new,       color: 'var(--aq-sage)'  },
              ]
              return (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={items} cx="50%" cy="50%" innerRadius={50} outerRadius={72}
                        paddingAngle={4} dataKey="value" nameKey="label">
                        {items.map(item => <Cell key={item.label} fill={item.color} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-6 mt-2">
                    {items.map(item => (
                      <div key={item.label} className="text-center">
                        <div className="flex items-center gap-1.5 justify-center mb-0.5">
                          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: item.color }} />
                          <span className="text-[11px]" style={{ color: 'var(--aq-text-secondary)' }}>{item.label}</span>
                        </div>
                        <div className="text-xl font-medium" style={{ color: 'var(--aq-text-primary)' }}>
                          {item.value}
                        </div>
                        <div className="text-[10px]" style={{ color: 'var(--aq-text-tertiary)' }}>
                          {total > 0 ? Math.round((item.value / total) * 100) : 0}%
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            })() : null}
          </CardPad>

          {/* Retention */}
          <CardPad>
            <ChartTitle sub="Based on last attendance date relative to period end">
              Member Retention
            </ChartTitle>
            {loading || !mounted ? <Pulse h={200} /> : data ? (() => {
              const r = data.retention
              const total = r.active + r.lapsing + r.lapsed
              const items = [
                { label: 'Active (0–30d)',   value: r.active,  color: 'var(--aq-sage)'  },
                { label: 'Lapsing (30–60d)', value: r.lapsing, color: 'var(--aq-amber)' },
                { label: 'Lapsed (60d+)',    value: r.lapsed,  color: 'var(--aq-rose)'  },
              ]
              return (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={items} cx="50%" cy="50%" innerRadius={50} outerRadius={72}
                        paddingAngle={4} dataKey="value" nameKey="label">
                        {items.map(item => <Cell key={item.label} fill={item.color} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-3">
                    {items.map(item => (
                      <div key={item.label} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                          <span style={{ color: 'var(--aq-text-secondary)' }}>{item.label}</span>
                        </div>
                        <span className="font-medium" style={{ color: 'var(--aq-text-primary)' }}>
                          {item.value}
                          <span className="font-normal ml-1" style={{ color: 'var(--aq-text-tertiary)' }}>
                            ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )
            })() : null}
          </CardPad>

          {/* Distribution */}
          <CardPad>
            <ChartTitle sub="How frequently individual members attend">
              Attendance Frequency
            </ChartTitle>
            {loading || !mounted ? <Pulse h={200} /> : data?.distribution.length ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.distribution} margin={{ top: 0, right: 4, left: -24, bottom: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false}
                      label={{ value: 'times', position: 'insideBottom', offset: -12, fontSize: 10, fill: TICK_FILL }} />
                    <YAxis tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE}
                      labelFormatter={l => `Attended ${l} times`}
                      formatter={v => [v, 'People']} />
                    <Bar dataKey="people" fill={C.purple} radius={[4, 4, 0, 0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
                <div
                  className="flex gap-5 text-xs mt-2 pt-3"
                  style={{ borderTop: '0.5px solid var(--aq-border)' }}
                >
                  <div>
                    <span style={{ color: 'var(--aq-text-tertiary)' }}>One-timers </span>
                    <span className="font-medium" style={{ color: 'var(--aq-text-primary)' }}>
                      {data.distribution.find(d => d.bucket === '1')?.people ?? 0}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--aq-text-tertiary)' }}>Regulars (7+) </span>
                    <span className="font-medium" style={{ color: 'var(--aq-text-primary)' }}>
                      {data.distribution
                        .filter(d => ['7–10','11–20','21+'].includes(d.bucket))
                        .reduce((s, d) => s + d.people, 0)}
                    </span>
                  </div>
                </div>
              </>
            ) : <Empty h={200} />}
          </CardPad>
        </div>
      )}

      {/* ── Monthly trends + Top attendees ───────────────────────────────── */}
      {!noData && (
        <div className="grid md:grid-cols-3 gap-5">

          <CardPad className="md:col-span-2">
            <ChartTitle sub="Bars = total check-ins · Line = month-over-month growth %">
              Monthly Attendance Trends
            </ChartTitle>
            {loading || !mounted ? <Pulse h={260} /> : data?.monthlyTrends.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={data.monthlyTrends} margin={{ top: 4, right: 32, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="r" orientation="right"
                    tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE}
                    formatter={(v, name) => name === 'Growth %' ? [`${v}%`, name] : [v, name]} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: TICK_FILL }} />
                  <Bar  yAxisId="l" dataKey="total"  name="Check-ins" fill={C.indigo} radius={[4, 4, 0, 0]} opacity={0.80} />
                  <Line yAxisId="r" type="monotone" dataKey="growth" name="Growth %"
                    stroke={C.green} strokeWidth={2}
                    dot={{ r: 3, fill: C.green, stroke: 'var(--aq-base)', strokeWidth: 2 }}
                    activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <Empty h={260} />}
          </CardPad>

          <CardPad>
            <ChartTitle sub="Ranked by meetings attended">Most Engaged Members</ChartTitle>
            {loading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-8 rounded-xl shimmer" style={{ background: 'var(--aq-surface)' }} />
                ))}
              </div>
            ) : data?.topAttendees.length ? (
              <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 300 }}>
                {data.topAttendees.map((p, i) => {
                  const max = data.topAttendees[0]?.times ?? 1
                  const pct = Math.round((p.times / max) * 100)
                  const top = i < 3
                  return (
                    <div key={i} className="flex items-center gap-2.5">
                      <span className="w-5 text-xs font-medium text-right shrink-0"
                        style={{ color: top ? 'var(--aq-amber)' : 'var(--aq-text-muted)' }}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium truncate" style={{ color: 'var(--aq-text-primary)' }}>
                            {p.name}
                          </span>
                          <span className="text-xs font-medium shrink-0 ml-2"
                            style={{ color: top ? 'var(--aq-amber)' : 'var(--aq-gold)' }}>
                            {p.times}×
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--aq-surface)' }}>
                          <div className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: top ? C.amber : C.indigo, opacity: 0.75 }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <Empty />}
          </CardPad>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  SECTION 2: AI ANALYTICS                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      <div ref={aiRef} className="pt-4">
        {/* Section header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(200,169,107,0.30)',
              border: '0.5px solid var(--aq-border)',
            }}
          >
            <Sparkles className="w-4 h-4" style={{ color: 'var(--aq-gold)' }} strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-base font-medium" style={{ color: 'var(--aq-text-primary)' }}>
              AI Analytics
            </h2>
            <p className="text-xs" style={{ color: 'var(--aq-text-tertiary)' }}>
              Ask any question — the AI queries the database and generates a chart
            </p>
          </div>
        </div>

        {/* Preset questions */}
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESET_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => submitAI(q)}
              disabled={aiLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
              style={{
                background: 'var(--aq-surface)',
                border: '0.5px solid var(--aq-border)',
                color: 'var(--aq-text-secondary)',
                cursor: aiLoading ? 'not-allowed' : 'pointer',
                opacity: aiLoading ? 0.45 : 1,
              }}
              onMouseEnter={e => {
                if (!aiLoading) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--aq-text-primary)'
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(200,169,107,0.12)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,169,107,0.22)'
                }
              }}
              onMouseLeave={e => {
                if (!aiLoading) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--aq-text-secondary)'
                  ;(e.currentTarget as HTMLElement).style.background = 'var(--aq-surface)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--aq-border)'
                }
              }}
            >
              <ChevronRight className="w-3 h-3 shrink-0" style={{ color: 'var(--aq-gold)' }} />
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <GlassCard style={{ padding: '12px' }}>
          <div className="flex gap-3">
            <input
              type="text"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !aiLoading && submitAI(aiPrompt)}
              placeholder="Ask anything about your church data…"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--aq-text-primary)' }}
              disabled={aiLoading}
            />
            <button
              onClick={() => submitAI(aiPrompt)}
              disabled={aiLoading || !aiPrompt.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
              style={{
                background: aiLoading || !aiPrompt.trim()
                  ? 'var(--aq-surface)'
                  : 'var(--aq-gold)',
                color: aiLoading || !aiPrompt.trim() ? 'var(--aq-text-muted)' : '#FFFFFF',
                cursor: aiLoading || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {aiLoading
                ? <RefreshCw className="w-4 h-4 spin-slow" />
                : <Send className="w-4 h-4" />}
              {aiLoading ? 'Thinking…' : 'Ask'}
            </button>
          </div>
        </GlassCard>

        {/* AI loading */}
        {aiLoading && (
          <CardPad className="mt-4">
            <div className="space-y-3">
              <Pulse h={32} />
              <Pulse h={20} />
              <Pulse h={260} />
              <Pulse h={48} />
            </div>
          </CardPad>
        )}

        {/* AI error */}
        {aiError && !aiLoading && (
          <div
            className="mt-4 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(194,95,95,0.10)', color: 'var(--aq-rose)', border: '0.5px solid rgba(194,95,95,0.20)' }}
          >
            {aiError}
          </div>
        )}

        {/* AI result */}
        {aiResult && !aiLoading && (
          <CardPad className="mt-4 fade-up">
            <div className="mb-4">
              <h3 className="font-medium" style={{ color: 'var(--aq-text-primary)' }}>
                {aiResult.chart.title}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--aq-text-tertiary)' }}>
                {aiResult.chart.description}
              </p>
            </div>

            <DynamicChart config={aiResult.chart} data={aiResult.data} />

            <div
              className="mt-5 pt-4 rounded-xl p-4"
              style={{
                background: 'rgba(200,169,107,0.10)',
                border: '0.5px solid var(--aq-border)',
              }}
            >
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--aq-gold)' }} />
                <p className="text-sm leading-relaxed" style={{ color: 'var(--aq-text-secondary)' }}>
                  {aiResult.insight}
                </p>
              </div>
            </div>

            <div className="mt-3">
              <button
                onClick={() => setShowSql(s => !s)}
                className="text-xs font-medium transition-colors"
                style={{ color: showSql ? 'var(--aq-gold)' : 'var(--aq-text-muted)' }}
              >
                {showSql ? 'Hide SQL' : 'View SQL'}
              </button>
              {showSql && (
                <pre
                  className="mt-2 p-3 rounded-xl overflow-x-auto text-xs leading-relaxed"
                  style={{
                    background: 'var(--aq-base)',
                    border: '0.5px solid var(--aq-border)',
                    color: 'var(--aq-text-secondary)',
                    fontFamily: 'var(--font-geist-mono), monospace',
                  }}
                >
                  {aiResult.sql}
                </pre>
              )}
            </div>
          </CardPad>
        )}
      </div>

      <div className="h-6" />
    </div>
  )
}

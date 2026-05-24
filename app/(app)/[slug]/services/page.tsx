'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import {
  Users, TrendingUp, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, AreaChart, Area,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ServiceEvent {
  id: string
  event_date: string
  service_type: string
  count: number
}

interface SundayRow {
  date: string
  label: string
  inPerson: number
  online: number
  total: number
  inPersonId: string
  onlineId: string
}

interface WedRow {
  date: string
  label: string
  count: number
  id: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GOLD   = '#C9A84C'
const TEAL   = '#22d3ee'
const PURPLE = '#a78bfa'
const GREEN  = '#34d399'
const AMBER  = '#fbbf24'

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)',
  backdropFilter: 'blur(32px) saturate(180%)',
  WebkitBackdropFilter: 'blur(32px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.065)',
  borderRadius: 20,
  boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 16px 48px rgba(0,0,0,0.35)',
}

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(8,12,28,0.96)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'rgba(255,255,255,0.88)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.50)',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtFull(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function calcTrend(values: number[]): number {
  if (values.length < 6) return 0
  const n     = Math.min(4, Math.floor(values.length / 2))
  const recent = values.slice(-n)
  const prior  = values.slice(-n * 2, -n)
  if (!prior.length) return 0
  const rAvg = recent.reduce((s, v) => s + v, 0) / recent.length
  const pAvg = prior.reduce((s, v) => s + v, 0) / prior.length
  return pAvg > 0 ? Math.round(((rAvg - pAvg) / pAvg) * 100) : 0
}

// ── KPI card ──────────────────────────────────────────────────────────────────

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
          <span style={{ fontSize: 11, color: tcolor }}>{trend > 0 ? '+' : ''}{trend}% vs prior 4 wks</span>
        </div>
      )}
    </div>
  )
}

// ── Table header row ──────────────────────────────────────────────────────────

function THead({ cols }: { cols: { label: string; align?: 'left' | 'right'; color?: string }[] }) {
  return (
    <div style={{ padding: '6px 24px 4px', display: 'grid', gridTemplateColumns: `1fr ${cols.slice(1).map(() => '80px').join(' ')}`, gap: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {cols.map((c, i) => (
        <span key={i} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: c.color ?? 'rgba(255,255,255,0.25)', textAlign: c.align ?? (i === 0 ? 'left' : 'right') }}>
          {c.label}
        </span>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const params = useParams()
  const slug = params?.slug as string

  const [events,  setEvents]  = useState<ServiceEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const sb = getSupabaseBrowser()
    async function load() {
      const { data: church } = await sb.from('churches').select('id').eq('slug', slug).single()
      if (!church) { setLoading(false); return }

      const { data } = await sb
        .from('events')
        .select('id, event_date, service_type, attendance(count)')
        .eq('church_id', church.id)
        .in('service_type', ['sunday_inperson', 'sunday_online', 'midweek'])
        .is('cell_id', null)
        .order('event_date', { ascending: true })

      const evs: ServiceEvent[] = (data ?? []).map((e: Record<string, unknown>) => {
        const att = e.attendance as { count: string }[] | null
        return {
          id:           e.id as string,
          event_date:   e.event_date as string,
          service_type: e.service_type as string,
          count:        att && att.length > 0 ? parseInt(att[0].count) : 0,
        }
      })
      setEvents(evs)
      setLoading(false)
    }
    load()
  }, [slug])

  // ── Derived data ─────────────────────────────────────────────────────────────

  const { sundayRows, wedRows, totals } = useMemo(() => {
    type SEntry = { inPerson: number; online: number; inPersonId: string; onlineId: string }
    const sundayMap = new Map<string, SEntry>()
    const wedList: WedRow[] = []

    for (const ev of events) {
      if (ev.service_type === 'sunday_inperson') {
        const row = sundayMap.get(ev.event_date) ?? { inPerson: 0, online: 0, inPersonId: '', onlineId: '' }
        row.inPerson   = ev.count
        row.inPersonId = ev.id
        sundayMap.set(ev.event_date, row)
      } else if (ev.service_type === 'sunday_online') {
        const row = sundayMap.get(ev.event_date) ?? { inPerson: 0, online: 0, inPersonId: '', onlineId: '' }
        row.online   = ev.count
        row.onlineId = ev.id
        sundayMap.set(ev.event_date, row)
      } else {
        wedList.push({ date: ev.event_date, label: fmtDate(ev.event_date), count: ev.count, id: ev.id })
      }
    }

    const sundayRows: SundayRow[] = [...sundayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({
        date, label: fmtDate(date),
        inPerson: v.inPerson, online: v.online,
        total: v.inPerson + v.online,
        inPersonId: v.inPersonId, onlineId: v.onlineId,
      }))

    const totalSunInperson = sundayRows.reduce((s, r) => s + r.inPerson, 0)
    const totalSunOnline   = sundayRows.reduce((s, r) => s + r.online, 0)
    const totalSunday      = totalSunInperson + totalSunOnline
    const avgSunday        = sundayRows.length > 0 ? Math.round(totalSunday / sundayRows.length) : 0
    const onlineServices   = sundayRows.filter(r => r.online > 0).length
    const avgOnline        = onlineServices > 0 ? Math.round(totalSunOnline / onlineServices) : 0
    const avgInperson      = sundayRows.length > 0 ? Math.round(totalSunInperson / sundayRows.length) : 0
    const totalWed         = wedList.reduce((s, r) => s + r.count, 0)
    const avgWed           = wedList.length > 0 ? Math.round(totalWed / wedList.length) : 0
    const sundayTrend      = calcTrend(sundayRows.map(r => r.total))
    const wedTrend         = calcTrend(wedList.map(r => r.count))
    const bestSunday       = Math.max(0, ...sundayRows.map(r => r.total))
    const bestWed          = Math.max(0, ...wedList.map(r => r.count))
    const bestSundayDate   = sundayRows.find(r => r.total === bestSunday)?.date ?? ''
    const bestWedDate      = wedList.find(r => r.count === bestWed)?.date ?? ''

    return {
      sundayRows,
      wedRows: wedList,
      totals: {
        totalSunday, avgSunday,
        totalSunInperson, totalSunOnline, avgInperson, avgOnline, onlineServices,
        totalWed, avgWed,
        sundayTrend, wedTrend,
        bestSunday, bestWed, bestSundayDate, bestWedDate,
        sundayCount: sundayRows.length,
        wedCount: wedList.length,
      },
    }
  }, [events])

  const dateRange = useMemo(() => {
    const all = events.map(e => e.event_date)
    if (!all.length) return ''
    const min = fmtDate(all.reduce((a, b) => a < b ? a : b))
    const max = fmtDate(all.reduce((a, b) => a > b ? a : b))
    return `${min} – ${max}`
  }, [events])

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="shimmer" style={{ height: 32, width: 200, borderRadius: 8, background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {[1,2,3,4].map(i => <div key={i} className="shimmer" style={{ height: 100, borderRadius: 20, background: 'rgba(255,255,255,0.04)' }} />)}
        </div>
        <div className="shimmer" style={{ height: 340, borderRadius: 20, background: 'rgba(255,255,255,0.04)' }} />
        <div className="shimmer" style={{ height: 340, borderRadius: 20, background: 'rgba(255,255,255,0.04)' }} />
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.022em', color: 'rgba(255,255,255,0.92)', margin: 0 }}>
          MEGA Services
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' }}>
          {dateRange} · {totals.sundayCount} Sundays · {totals.wedCount} Wednesdays
        </p>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
        <KPI
          label="Total Sunday Reach"
          value={totals.totalSunday.toLocaleString()}
          sub={`${totals.totalSunInperson} in-person · ${totals.totalSunOnline} online`}
          icon={Users} color={GOLD} trend={totals.sundayTrend}
        />
        <KPI
          label="Sunday Avg / Week"
          value={totals.avgSunday}
          sub={`${totals.avgInperson} in-person · ${totals.avgOnline} online avg`}
          icon={TrendingUp} color={AMBER}
        />
        <KPI
          label="Total Midweek Reach"
          value={totals.totalWed.toLocaleString()}
          sub={`${totals.wedCount} services`}
          icon={Users} color={PURPLE} trend={totals.wedTrend}
        />
        <KPI
          label="Midweek Avg / Week"
          value={totals.avgWed}
          sub={`Best: ${totals.bestWed} on ${fmtDate(totals.bestWedDate)}`}
          icon={TrendingUp} color={GREEN}
        />
      </div>

      {/* ── Sunday Services ────────────────────────────────────────────────────── */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', marginBottom: 20 }}>

        {/* Section header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.88)', margin: 0 }}>Sunday Services</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', margin: '3px 0 0' }}>
              In-person + Online · {totals.sundayCount} Sundays
              {totals.bestSundayDate ? ` · Best: ${totals.bestSunday} on ${fmtDate(totals.bestSundayDate)}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: GOLD, flexShrink: 0 }} />
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>In-Person</span>
              <strong style={{ color: 'rgba(255,255,255,0.80)' }}>{totals.totalSunInperson}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: TEAL, flexShrink: 0 }} />
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>Online</span>
              <strong style={{ color: 'rgba(255,255,255,0.80)' }}>{totals.totalSunOnline}</strong>
              <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11 }}>({totals.onlineServices} svc)</span>
            </div>
          </div>
        </div>

        {/* Chart */}
        {mounted && sundayRows.length > 0 && (
          <div style={{ padding: '20px 24px 4px' }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sundayRows} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="28%">
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOLD} stopOpacity={1} />
                    <stop offset="100%" stopColor={GOLD} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => [value, name === 'inPerson' ? 'In-Person' : 'Online'] as any}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  labelFormatter={(l: any) => `Sunday · ${l}`}
                />
                <Bar dataKey="inPerson" stackId="s" fill="url(#goldGrad)" name="inPerson" radius={[0, 0, 3, 3]} maxBarSize={36} />
                <Bar dataKey="online"   stackId="s" fill={TEAL}            name="online"    radius={[3, 3, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Per-Sunday table */}
        <THead cols={[
          { label: 'Date' },
          { label: 'In-Person', align: 'right' },
          { label: 'Online', align: 'right', color: `${TEAL}88` },
          { label: 'Total', align: 'right', color: `${GOLD}88` },
        ]} />
        <div>
          {[...sundayRows].reverse().map((row, i) => {
            const pct    = totals.bestSunday > 0 ? (row.total / totals.bestSunday) * 100 : 0
            const isBest = row.total === totals.bestSunday && row.total > 0
            return (
              <div key={row.date} style={{ position: 'relative', padding: '9px 24px', display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 8, borderBottom: i < sundayRows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * 0.4}%`, background: `${GOLD}06`, pointerEvents: 'none', borderRadius: '0 4px 4px 0' }} />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.70)', position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {fmtFull(row.date)}
                  {isBest && (
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: `${GOLD}22`, color: GOLD, fontWeight: 600 }}>Best</span>
                  )}
                </span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', textAlign: 'right', position: 'relative' }}>
                  {row.inPerson > 0 ? row.inPerson : <span style={{ color: 'rgba(255,255,255,0.18)' }}>—</span>}
                </span>
                <span style={{ fontSize: 13, textAlign: 'right', position: 'relative', color: row.online > 0 ? `${TEAL}cc` : 'rgba(255,255,255,0.18)' }}>
                  {row.online > 0 ? row.online : '—'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'right', position: 'relative', color: isBest ? GOLD : 'rgba(255,255,255,0.85)' }}>
                  {row.total}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Wednesday Services ─────────────────────────────────────────────────── */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>

        {/* Section header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.88)', margin: 0 }}>Wednesday Midweek Services</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', margin: '3px 0 0' }}>
              {totals.wedCount} services · {totals.totalWed.toLocaleString()} total
              {totals.bestWedDate ? ` · Best: ${totals.bestWed} on ${fmtDate(totals.bestWedDate)}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: PURPLE, flexShrink: 0 }} />
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>Total:</span>
            <strong style={{ color: 'rgba(255,255,255,0.80)' }}>{totals.totalWed.toLocaleString()}</strong>
          </div>
        </div>

        {/* Chart */}
        {mounted && wedRows.length > 0 && (
          <div style={{ padding: '20px 24px 4px' }}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={wedRows} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={PURPLE} stopOpacity={0.45} />
                    <stop offset="95%" stopColor={PURPLE} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [v, 'Attended'] as any}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  labelFormatter={(l: any) => `Wednesday · ${l}`}
                />
                <Area type="monotone" dataKey="count" stroke={PURPLE} fill="url(#purpleGrad)" strokeWidth={2}
                  dot={{ r: 3, fill: PURPLE, stroke: 'rgba(8,12,28,0.90)', strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: PURPLE }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Per-Wednesday table */}
        <THead cols={[
          { label: 'Date' },
          { label: 'Attendance', align: 'right', color: `${PURPLE}88` },
          { label: 'vs Avg', align: 'right' },
        ]} />
        <div>
          {[...wedRows].reverse().map((row, i) => {
            const pct    = totals.bestWed > 0 ? (row.count / totals.bestWed) * 100 : 0
            const isBest = row.count === totals.bestWed && row.count > 0
            const diff   = row.count - totals.avgWed
            return (
              <div key={row.date} style={{ position: 'relative', padding: '9px 24px', display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8, borderBottom: i < wedRows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * 0.4}%`, background: `${PURPLE}06`, pointerEvents: 'none', borderRadius: '0 4px 4px 0' }} />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.70)', position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {fmtFull(row.date)}
                  {isBest && (
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: `${PURPLE}22`, color: PURPLE, fontWeight: 600 }}>Best</span>
                  )}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'right', position: 'relative', color: isBest ? PURPLE : 'rgba(255,255,255,0.85)' }}>
                  {row.count}
                </span>
                <span style={{ fontSize: 12, textAlign: 'right', position: 'relative', color: diff > 0 ? `${GREEN}cc` : diff < 0 ? 'rgba(248,113,113,0.75)' : 'rgba(255,255,255,0.30)' }}>
                  {diff > 0 ? `+${diff}` : diff < 0 ? diff : '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

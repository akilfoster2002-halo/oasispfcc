'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import {
  Users, TrendingUp, ArrowUpRight, ArrowDownRight, Minus,
  ChevronDown, Radio,
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
  group_id: string
  group_name: string
  count: number
}

interface SundayRow { date: string; label: string; inPerson: number; online: number; total: number }
interface ServiceRow { date: string; label: string; count: number }

// ── Constants ─────────────────────────────────────────────────────────────────

const GOLD   = '#C9A84C'
const TEAL   = '#22d3ee'
const PURPLE = '#a78bfa'
const GREEN  = '#34d399'
const AMBER  = '#fbbf24'
const BLUE   = '#60a5fa'

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(8,12,28,0.96)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '10px', fontSize: '12px',
  color: 'rgba(255,255,255,0.88)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.50)',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function fmtFull(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function calcTrend(values: number[]): number {
  if (values.length < 6) return 0
  const n = Math.min(4, Math.floor(values.length / 2))
  const recent = values.slice(-n), prior = values.slice(-n * 2, -n)
  if (!prior.length) return 0
  const rAvg = recent.reduce((s, v) => s + v, 0) / recent.length
  const pAvg = prior.reduce((s, v) => s + v, 0) / prior.length
  return pAvg > 0 ? Math.round(((rAvg - pAvg) / pAvg) * 100) : 0
}
function slugify(s: string) { return s.replace(/[^a-z0-9]/gi, '_') }

// ── Mini KPI ──────────────────────────────────────────────────────────────────

function MiniKPI({ label, value, sub, color, trend }: {
  label: string; value: string | number; sub?: string; color: string; trend?: number
}) {
  const TIcon  = trend === undefined || trend === 0 ? Minus : trend > 0 ? ArrowUpRight : ArrowDownRight
  const tcolor = trend === undefined || trend === 0 ? 'rgba(255,255,255,0.28)' : trend > 0 ? GREEN : '#f87171'
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: '14px 16px', flex: 1, minWidth: 0,
    }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.92)', margin: '4px 0 0', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', margin: '3px 0 0' }}>{sub}</p>}
      {trend !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 8 }}>
          <TIcon style={{ width: 11, height: 11, color: tcolor, flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: tcolor }}>{trend > 0 ? '+' : ''}{trend}% vs prior 4 wks</span>
        </div>
      )}
      <div style={{ width: '100%', height: 2, borderRadius: 99, background: `${color}22`, marginTop: 10 }}>
        <div style={{ height: '100%', borderRadius: 99, background: color, width: '60%' }} />
      </div>
    </div>
  )
}

// ── Table header ──────────────────────────────────────────────────────────────

function THead({ cols }: { cols: { label: string; align?: 'left' | 'right'; color?: string }[] }) {
  return (
    <div style={{ padding: '6px 20px 4px', display: 'grid', gridTemplateColumns: `1fr ${cols.slice(1).map(() => '72px').join(' ')}`, gap: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {cols.map((c, i) => (
        <span key={i} style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: c.color ?? 'rgba(255,255,255,0.22)', textAlign: c.align ?? (i === 0 ? 'left' : 'right') }}>
          {c.label}
        </span>
      ))}
    </div>
  )
}

// ── Per-group stats block ─────────────────────────────────────────────────────

function GroupStats({ events, groupKey, mounted }: { events: ServiceEvent[]; groupKey: string; mounted: boolean }) {
  const gid = slugify(groupKey)

  // Split by service type
  const sundayMap = new Map<string, SundayRow>()
  const midweekList: ServiceRow[] = []
  const otherMap = new Map<string, ServiceRow[]>()

  for (const ev of events) {
    if (ev.service_type === 'sunday_inperson') {
      const r = sundayMap.get(ev.event_date) ?? { date: ev.event_date, label: fmtDate(ev.event_date), inPerson: 0, online: 0, total: 0 }
      r.inPerson = ev.count; r.total = r.inPerson + r.online
      sundayMap.set(ev.event_date, r)
    } else if (ev.service_type === 'sunday_online') {
      const r = sundayMap.get(ev.event_date) ?? { date: ev.event_date, label: fmtDate(ev.event_date), inPerson: 0, online: 0, total: 0 }
      r.online = ev.count; r.total = r.inPerson + r.online
      sundayMap.set(ev.event_date, r)
    } else if (ev.service_type === 'midweek') {
      midweekList.push({ date: ev.event_date, label: fmtDate(ev.event_date), count: ev.count })
    } else {
      const key = ev.service_type
      if (!otherMap.has(key)) otherMap.set(key, [])
      otherMap.get(key)!.push({ date: ev.event_date, label: fmtDate(ev.event_date), count: ev.count })
    }
  }

  const sundayRows = [...sundayMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, r]) => r)
  const wedRows    = midweekList.sort((a, b) => a.date.localeCompare(b.date))

  const totalSunInperson = sundayRows.reduce((s, r) => s + r.inPerson, 0)
  const totalSunOnline   = sundayRows.reduce((s, r) => s + r.online, 0)
  const totalSunday      = totalSunInperson + totalSunOnline
  const avgSunday        = sundayRows.length > 0 ? Math.round(totalSunday / sundayRows.length) : 0
  const bestSunday       = Math.max(0, ...sundayRows.map(r => r.total))
  const totalWed         = wedRows.reduce((s, r) => s + r.count, 0)
  const avgWed           = wedRows.length > 0 ? Math.round(totalWed / wedRows.length) : 0
  const bestWed          = Math.max(0, ...wedRows.map(r => r.count))
  const sundayTrend      = calcTrend(sundayRows.map(r => r.total))
  const wedTrend         = calcTrend(wedRows.map(r => r.count))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI row */}
      {(sundayRows.length > 0 || wedRows.length > 0) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {sundayRows.length > 0 && (
            <MiniKPI label="Sunday Avg" value={avgSunday}
              sub={`${totalSunInperson} in-person · ${totalSunOnline} online`}
              color={GOLD} trend={sundayTrend} />
          )}
          {wedRows.length > 0 && (
            <MiniKPI label="Midweek Avg" value={avgWed}
              sub={`${wedRows.length} services · ${totalWed} total`}
              color={PURPLE} trend={wedTrend} />
          )}
          {[...otherMap.entries()].map(([type, rows]) => {
            const tot = rows.reduce((s, r) => s + r.count, 0)
            const avg = rows.length > 0 ? Math.round(tot / rows.length) : 0
            const label = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            return (
              <MiniKPI key={type} label={`${label} Avg`} value={avg}
                sub={`${rows.length} sessions · ${tot} total`}
                color={BLUE} />
            )
          })}
        </div>
      )}

      {/* Sunday section */}
      {sundayRows.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.82)', margin: 0 }}>Sunday Services</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', margin: '2px 0 0' }}>
                {sundayRows.length} Sundays · Best: {bestSunday} on {fmtDate(sundayRows.find(r => r.total === bestSunday)?.date ?? '')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.40)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: GOLD, display: 'inline-block' }} />
                In-Person <strong style={{ color: 'rgba(255,255,255,0.75)', marginLeft: 2 }}>{totalSunInperson}</strong>
              </span>
              {totalSunOnline > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.40)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: TEAL, display: 'inline-block' }} />
                  Online <strong style={{ color: 'rgba(255,255,255,0.75)', marginLeft: 2 }}>{totalSunOnline}</strong>
                </span>
              )}
            </div>
          </div>
          {mounted && sundayRows.length > 1 && (
            <div style={{ padding: '16px 20px 4px' }}>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={sundayRows} margin={{ top: 0, right: 0, left: -24, bottom: 0 }} barCategoryGap="30%">
                  <defs>
                    <linearGradient id={`gold_${gid}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GOLD} stopOpacity={1} />
                      <stop offset="100%" stopColor={GOLD} stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.30)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.30)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any, n: any) => [v, n === 'inPerson' ? 'In-Person' : 'Online'] as any}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    labelFormatter={(l: any) => `Sunday · ${l}`}
                  />
                  <Bar dataKey="inPerson" stackId="s" fill={`url(#gold_${gid})`} radius={[0, 0, 3, 3]} maxBarSize={32} />
                  {totalSunOnline > 0 && <Bar dataKey="online" stackId="s" fill={TEAL} radius={[3, 3, 0, 0]} maxBarSize={32} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <THead cols={[{ label: 'Date' }, { label: 'In-Person', align: 'right' }, ...(totalSunOnline > 0 ? [{ label: 'Online', align: 'right' as const, color: `${TEAL}88` }] : []), { label: 'Total', align: 'right', color: `${GOLD}88` }]} />
          <div>
            {[...sundayRows].reverse().map((row, i) => {
              const isBest = row.total === bestSunday && row.total > 0
              return (
                <div key={row.date} style={{ padding: '8px 20px', display: 'grid', gridTemplateColumns: `1fr 72px${totalSunOnline > 0 ? ' 72px' : ''} 72px`, gap: 8, borderBottom: i < sundayRows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', position: 'relative' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {fmtFull(row.date)}
                    {isBest && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${GOLD}22`, color: GOLD, fontWeight: 600 }}>Best</span>}
                  </span>
                  <span style={{ fontSize: 12, textAlign: 'right', color: 'rgba(255,255,255,0.60)' }}>{row.inPerson || <span style={{ color: 'rgba(255,255,255,0.18)' }}>—</span>}</span>
                  {totalSunOnline > 0 && <span style={{ fontSize: 12, textAlign: 'right', color: row.online > 0 ? `${TEAL}cc` : 'rgba(255,255,255,0.18)' }}>{row.online || '—'}</span>}
                  <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', color: isBest ? GOLD : 'rgba(255,255,255,0.85)' }}>{row.total}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Midweek section */}
      {wedRows.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.82)', margin: 0 }}>Midweek Services</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', margin: '2px 0 0' }}>
                {wedRows.length} services · {totalWed} total · Best: {bestWed}
              </p>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Avg <strong style={{ color: PURPLE, marginLeft: 3 }}>{avgWed}</strong></span>
          </div>
          {mounted && wedRows.length > 1 && (
            <div style={{ padding: '16px 20px 4px' }}>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={wedRows} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`purple_${gid}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PURPLE} stopOpacity={0.40} />
                      <stop offset="95%" stopColor={PURPLE} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.30)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.30)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => [v, 'Attended'] as any}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    labelFormatter={(l: any) => `Midweek · ${l}`}
                  />
                  <Area type="monotone" dataKey="count" stroke={PURPLE} fill={`url(#purple_${gid})`} strokeWidth={2}
                    dot={{ r: 2, fill: PURPLE, stroke: 'rgba(8,12,28,0.9)', strokeWidth: 2 }}
                    activeDot={{ r: 4, fill: PURPLE }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <THead cols={[{ label: 'Date' }, { label: 'Attendance', align: 'right', color: `${PURPLE}88` }, { label: 'vs Avg', align: 'right' }]} />
          <div>
            {[...wedRows].reverse().map((row, i) => {
              const isBest = row.count === bestWed && row.count > 0
              const diff   = row.count - avgWed
              return (
                <div key={row.date} style={{ padding: '8px 20px', display: 'grid', gridTemplateColumns: '1fr 72px 72px', gap: 8, borderBottom: i < wedRows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {fmtFull(row.date)}
                    {isBest && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${PURPLE}22`, color: PURPLE, fontWeight: 600 }}>Best</span>}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', color: isBest ? PURPLE : 'rgba(255,255,255,0.85)' }}>{row.count}</span>
                  <span style={{ fontSize: 11, textAlign: 'right', color: diff > 0 ? `${GREEN}cc` : diff < 0 ? 'rgba(248,113,113,0.75)' : 'rgba(255,255,255,0.28)' }}>
                    {diff > 0 ? `+${diff}` : diff < 0 ? diff : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Other service types (e.g. Faith Fusion) */}
      {[...otherMap.entries()].map(([type, rows]) => {
        const sorted  = [...rows].sort((a, b) => a.date.localeCompare(b.date))
        const tot     = sorted.reduce((s, r) => s + r.count, 0)
        const avg     = sorted.length > 0 ? Math.round(tot / sorted.length) : 0
        const best    = Math.max(0, ...sorted.map(r => r.count))
        const typeLabel = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        return (
          <div key={type} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.82)', margin: 0 }}>{typeLabel}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', margin: '2px 0 0' }}>{sorted.length} sessions · {tot} total</p>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Avg <strong style={{ color: AMBER, marginLeft: 3 }}>{avg}</strong></span>
            </div>
            <THead cols={[{ label: 'Date' }, { label: 'Attendance', align: 'right', color: `${AMBER}88` }, { label: 'vs Avg', align: 'right' }]} />
            <div>
              {[...sorted].reverse().map((row, i) => {
                const isBest = row.count === best && row.count > 0
                const diff   = row.count - avg
                return (
                  <div key={row.date} style={{ padding: '8px 20px', display: 'grid', gridTemplateColumns: '1fr 72px 72px', gap: 8, borderBottom: i < sorted.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {fmtFull(row.date)}
                      {isBest && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${AMBER}22`, color: AMBER, fontWeight: 600 }}>Best</span>}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', color: isBest ? AMBER : 'rgba(255,255,255,0.85)' }}>{row.count}</span>
                    <span style={{ fontSize: 11, textAlign: 'right', color: diff > 0 ? `${GREEN}cc` : diff < 0 ? 'rgba(248,113,113,0.75)' : 'rgba(255,255,255,0.28)' }}>
                      {diff > 0 ? `+${diff}` : diff < 0 ? diff : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const params = useParams()
  const slug   = params?.slug as string

  const [events,  setEvents]  = useState<ServiceEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const sb = getSupabaseBrowser()
    async function load() {
      const { data: church } = await sb.from('churches').select('id').eq('slug', slug).single()
      if (!church) { setLoading(false); return }

      const today = new Date().toISOString().split('T')[0]
      const { data } = await sb
        .from('events')
        .select('id, event_date, service_type, group_id, groups(name), attendance(count)')
        .eq('church_id', church.id)
        .in('service_type', ['sunday_inperson', 'sunday_online', 'midweek', 'other'])
        .is('cell_id', null)
        .not('group_id', 'is', null)
        .lte('event_date', today)
        .order('event_date', { ascending: true })

      const evs: ServiceEvent[] = (data ?? []).map((e: Record<string, unknown>) => {
        const att = e.attendance as { count: string }[] | null
        const grp = e.groups as { name: string } | null
        return {
          id:           e.id as string,
          event_date:   e.event_date as string,
          service_type: e.service_type as string,
          group_id:     e.group_id as string,
          group_name:   grp?.name ?? 'Ungrouped',
          count:        att && att.length > 0 ? parseInt(att[0].count) : 0,
        }
      })
      setEvents(evs)

      // Auto-expand all groups
      const keys = [...new Set(evs.map(e => e.group_name))]
      setExpanded(new Set(keys))
      setLoading(false)
    }
    load()
  }, [slug])

  const groupMap = useMemo(() => {
    const m = new Map<string, ServiceEvent[]>()
    for (const ev of events) {
      if (!m.has(ev.group_name)) m.set(ev.group_name, [])
      m.get(ev.group_name)!.push(ev)
    }
    return m
  }, [events])

  const sortedGroups = useMemo(() =>
    [...groupMap.keys()].sort((a, b) => a.localeCompare(b)),
    [groupMap]
  )

  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2].map(i => (
          <div key={i} className="shimmer" style={{ height: 72, borderRadius: 18, background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.22)', flexShrink: 0 }}>
          <Radio style={{ width: 18, height: 18, color: GOLD }} />
        </div>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em', margin: 0 }}>Services</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>
            {sortedGroups.length} group{sortedGroups.length !== 1 ? 's' : ''} · {events.length} service records
          </p>
        </div>
      </div>

      {/* Group accordions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sortedGroups.map(groupKey => {
          const groupEvents = groupMap.get(groupKey)!
          const isOpen      = expanded.has(groupKey)

          // Summary counts for header
          const sundayCount  = new Set(groupEvents.filter(e => e.service_type === 'sunday_inperson').map(e => e.event_date)).size
          const midweekCount = groupEvents.filter(e => e.service_type === 'midweek').length
          const avgSun = sundayCount > 0
            ? Math.round(groupEvents.filter(e => e.service_type === 'sunday_inperson').reduce((s, e) => s + e.count, 0) / sundayCount)
            : 0
          const avgWed = midweekCount > 0
            ? Math.round(groupEvents.filter(e => e.service_type === 'midweek').reduce((s, e) => s + e.count, 0) / midweekCount)
            : 0

          return (
            <div key={groupKey} style={{
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.07)',
              background: 'linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
              overflow: 'hidden',
            }}>
              {/* Group header */}
              <button
                onClick={() => toggle(groupKey)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.22)' }}>
                  <Radio style={{ width: 15, height: 15, color: GOLD }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)', margin: 0, letterSpacing: '-0.01em' }}>{groupKey}</p>
                  <div style={{ display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
                    {sundayCount > 0 && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                        <span style={{ color: GOLD }}>●</span> {sundayCount} Sundays · avg {avgSun}
                      </span>
                    )}
                    {midweekCount > 0 && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                        <span style={{ color: PURPLE }}>●</span> {midweekCount} Midweeks · avg {avgWed}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.28)', flexShrink: 0, transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 200ms ease' }} />
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: 16 }}>
                  <GroupStats events={groupEvents} groupKey={groupKey} mounted={mounted} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

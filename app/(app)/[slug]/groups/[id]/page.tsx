'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowLeft, Layers, CalendarDays, Users, ChevronLeft, ChevronRight } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

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
interface WeeklyData {
  range: { thisWeek: { start: string; end: string }; lastWeek: { start: string; end: string } }
  cells: WeeklyCell[]
  groups: WeeklyGroup[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sundayOfWeek(d: Date): Date {
  const s = new Date(d)
  s.setDate(d.getDate() - d.getDay())
  return s
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function fmtDateRange(start: string, end: string): string {
  const s = new Date(start + 'T12:00:00Z')
  const e = new Date(end   + 'T12:00:00Z')
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' }
  if (s.getUTCFullYear() !== e.getUTCFullYear())
    return `${s.toLocaleDateString('en-US', { ...opts, year: 'numeric', timeZone: 'UTC' })} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric', timeZone: 'UTC' })}`
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric', timeZone: 'UTC' })}`
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  const diff = cur - prev
  if (diff === 0 || prev === 0) return null
  const up = diff > 0
  return (
    <span style={{ fontSize: 10, marginLeft: 4, color: up ? '#34d399' : '#f87171' }}>
      {up ? '▲' : '▼'}{Math.abs(diff)}
    </span>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const thS: React.CSSProperties = {
  padding: '8px 10px', fontSize: '10px', fontWeight: 600,
  color: 'rgba(255,255,255,0.38)', textAlign: 'left',
  whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.08)',
}
const tdS: React.CSSProperties = {
  padding: '8px 10px', fontSize: '12px',
  color: 'rgba(255,255,255,0.82)', borderBottom: '1px solid rgba(255,255,255,0.04)',
  whiteSpace: 'nowrap',
}
const numTd: React.CSSProperties = { ...tdS, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

function TableCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.022) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.80)' }}>{title}</p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.30)' }}>{sub}</p>}
      </div>
      {children}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: groupId } = use(params)
  const routeParams = useParams()
  const slug = routeParams?.slug as string

  const [groupName, setGroupName] = useState('')
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => new Date())
  const [weekly, setWeekly] = useState<WeeklyData | null>(null)
  const [weekLoading, setWeekLoading] = useState(true)

  // Resolve group name once
  useEffect(() => {
    getSupabaseBrowser()
      .from('groups').select('name').eq('id', groupId).single()
      .then(({ data }) => setGroupName(data?.name ?? ''))
  }, [groupId])

  // Fetch weekly data whenever anchor or group name changes
  const fetchWeekly = useCallback(async (anchor: Date, name: string) => {
    if (!name) return
    setWeekLoading(true)
    const sunday    = sundayOfWeek(anchor)
    const saturday  = addDays(sunday, 6)
    const to   = toDateStr(saturday)
    const from = toDateStr(sunday)
    try {
      const res = await fetch(
        `/api/analytics?from=${from}&to=${to}&group=${encodeURIComponent(name)}`
      )
      const d = await res.json()
      if (d.weekly) setWeekly(d.weekly)
    } finally {
      setWeekLoading(false)
    }
  }, [])

  useEffect(() => {
    if (groupName) fetchWeekly(weekAnchor, groupName)
  }, [weekAnchor, groupName, fetchWeekly])

  const prevWeek = () => setWeekAnchor(a => addDays(a, -7))
  const nextWeek = () => setWeekAnchor(a => addDays(a, 7))
  const isCurrentWeek = toDateStr(sundayOfWeek(weekAnchor)) === toDateStr(sundayOfWeek(new Date()))

  const twLabel = weekly ? fmtDateRange(weekly.range.thisWeek.start, weekly.range.thisWeek.end) : '—'
  const lwLabel = weekly ? fmtDateRange(weekly.range.lastWeek.start, weekly.range.lastWeek.end) : '—'

  const cells  = weekly?.cells  ?? []
  const groups = weekly?.groups ?? []
  const gRow   = groups[0] ?? null  // scoped to one group

  return (
    <div
      className="min-h-screen px-6 py-8"
      style={{ background: 'linear-gradient(180deg, rgba(10,14,35,0.95) 0%, rgba(8,12,26,0.98) 100%)' }}
    >
      <div className="max-w-5xl mx-auto">

        {/* Back */}
        <Link
          href={`/${slug}/groups`}
          className="inline-flex items-center gap-2 text-sm mb-6 hover:opacity-70 transition-opacity"
          style={{ color: 'rgba(255,255,255,0.40)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Groups
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-7 gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(251,191,36,0.22) 0%, rgba(245,158,11,0.14) 100%)',
                border: '1px solid rgba(251,191,36,0.28)',
              }}
            >
              <Layers className="w-5 h-5" style={{ color: '#fbbf24' }} />
            </div>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>
                {groupName || '—'}
              </h1>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>Weekly Overview</p>
            </div>
          </div>

          {/* Week navigator */}
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <button
              onClick={prevWeek}
              className="p-1 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center px-2">
              <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                {twLabel}
              </p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {isCurrentWeek ? 'Current week' : 'vs ' + lwLabel}
              </p>
            </div>
            <button
              onClick={nextWeek}
              disabled={isCurrentWeek}
              className="p-1 rounded-lg transition-colors hover:bg-white/10 disabled:opacity-30"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Cell Data ─────────────────────────────────────────────────────── */}
        <div className="mb-5">
          <TableCard
            title="Cell Data"
            sub={`This week (${twLabel}) vs last week (${lwLabel})`}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 680 }}>
                <thead>
                  <tr>
                    <th style={{ ...thS, paddingLeft: 20 }}>Cell</th>
                    <th style={thS}>Meeting Type</th>
                    <th style={{ ...thS, textAlign: 'right' }}>Att<br /><span style={{ fontWeight: 400 }}>This Week</span></th>
                    <th style={{ ...thS, textAlign: 'right' }}>Att<br /><span style={{ fontWeight: 400 }}>Last Week</span></th>
                    <th style={{ ...thS, textAlign: 'right' }}>Soul Won<br /><span style={{ fontWeight: 400 }}>In Cell</span></th>
                    <th style={{ ...thS, textAlign: 'right' }}>FS Enrolled</th>
                    <th style={{ ...thS, textAlign: 'right' }}>Total<br /><span style={{ fontWeight: 400 }}>Soul Won</span></th>
                    <th style={{ ...thS, textAlign: 'right', paddingRight: 20 }}>Substantiations</th>
                  </tr>
                </thead>
                <tbody>
                  {weekLoading ? (
                    <tr>
                      <td colSpan={7} style={{ ...tdS, textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.22)' }}>
                        Loading…
                      </td>
                    </tr>
                  ) : cells.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ ...tdS, textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.22)' }}>
                        No cell meetings this week
                      </td>
                    </tr>
                  ) : cells.map((c, i) => (
                    <tr key={i}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ ...tdS, paddingLeft: 20, fontWeight: 500 }}>{c.cellName}</td>
                      <td style={{ ...tdS, fontSize: 11 }}>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: 'rgba(34,211,238,0.12)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.25)' }}
                        >
                          Cell
                        </span>
                      </td>
                      <td style={numTd}>
                        <span className="font-semibold">{c.attThis}</span>
                        <Delta cur={c.attThis} prev={c.attLast} />
                      </td>
                      <td style={{ ...numTd, color: 'rgba(255,255,255,0.35)' }}>{c.attLast}</td>
                      <td style={{ ...numTd, color: c.soulWon > 0 ? '#34d399' : undefined }}>{c.soulWon}</td>
                      <td style={{ ...numTd, color: c.fsEnrolled > 0 ? '#22d3ee' : undefined }}>{c.fsEnrolled}</td>
                      <td style={{ ...numTd, color: c.soulWon > 0 ? '#34d399' : undefined }}>{c.soulWon}</td>
                      <td style={{ ...numTd, paddingRight: 20, color: c.substantiations > 0 ? '#a78bfa' : undefined }}>{c.substantiations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableCard>
        </div>

        {/* ── Group Data ────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <TableCard
            title="Group Data"
            sub="This week vs last week — arrows show direction of change"
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 860 }}>
                <thead>
                  <tr>
                    <th style={{ ...thS, paddingLeft: 20 }}>Date</th>
                    <th style={{ ...thS, textAlign: 'right' }}>Total Cell Att<br /><span style={{ fontWeight: 400 }}>this / last</span></th>
                    <th style={{ ...thS, textAlign: 'right' }}>Sunday Att<br /><span style={{ fontWeight: 400 }}>this / last</span></th>
                    <th style={{ ...thS, textAlign: 'right' }}>Sun 1st Timers<br /><span style={{ fontWeight: 400 }}>this / last</span></th>
                    <th style={{ ...thS, textAlign: 'right' }}>Wed Att<br /><span style={{ fontWeight: 400 }}>this / last</span></th>
                    <th style={{ ...thS, textAlign: 'right' }}>Soul Won<br /><span style={{ fontWeight: 400 }}>this / last</span></th>
                    <th style={{ ...thS, textAlign: 'right', paddingRight: 20 }}>Unique Attendees<br /><span style={{ fontWeight: 400 }}>this / last</span></th>
                  </tr>
                </thead>
                <tbody>
                  {weekLoading ? (
                    <tr>
                      <td colSpan={7} style={{ ...tdS, textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.22)' }}>
                        Loading…
                      </td>
                    </tr>
                  ) : !gRow ? (
                    <tr>
                      <td colSpan={7} style={{ ...tdS, textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.22)' }}>
                        No data for this week
                      </td>
                    </tr>
                  ) : (
                    <tr
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ ...tdS, paddingLeft: 20, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                        {twLabel}
                      </td>
                      <td style={numTd}>
                        <span className="font-semibold">{gRow.cellAttThis}</span>
                        <Delta cur={gRow.cellAttThis} prev={gRow.cellAttLast} />
                        <span style={{ color: 'rgba(255,255,255,0.28)', marginLeft: 4 }}>/ {gRow.cellAttLast}</span>
                      </td>
                      <td style={numTd}>
                        <span className="font-semibold">{gRow.sundayAttThis}</span>
                        <Delta cur={gRow.sundayAttThis} prev={gRow.sundayAttLast} />
                        <span style={{ color: 'rgba(255,255,255,0.28)', marginLeft: 4 }}>/ {gRow.sundayAttLast}</span>
                      </td>
                      <td style={numTd}>
                        <span className="font-semibold">{gRow.sunFirstTimersThis}</span>
                        <Delta cur={gRow.sunFirstTimersThis} prev={gRow.sunFirstTimersLast} />
                        <span style={{ color: 'rgba(255,255,255,0.28)', marginLeft: 4 }}>/ {gRow.sunFirstTimersLast}</span>
                      </td>
                      <td style={numTd}>
                        <span className="font-semibold">{gRow.wedAttThis}</span>
                        <Delta cur={gRow.wedAttThis} prev={gRow.wedAttLast} />
                        <span style={{ color: 'rgba(255,255,255,0.28)', marginLeft: 4 }}>/ {gRow.wedAttLast}</span>
                      </td>
                      <td style={numTd}>
                        <span className="font-semibold" style={{ color: gRow.soulWonThis > 0 ? '#34d399' : undefined }}>
                          {gRow.soulWonThis}
                        </span>
                        <Delta cur={gRow.soulWonThis} prev={gRow.soulWonLast} />
                        <span style={{ color: 'rgba(255,255,255,0.28)', marginLeft: 4 }}>/ {gRow.soulWonLast}</span>
                      </td>
                      <td style={{ ...numTd, paddingRight: 20 }}>
                        <span className="font-semibold">{gRow.uniqueThis}</span>
                        <Delta cur={gRow.uniqueThis} prev={gRow.uniqueLast} />
                        <span style={{ color: 'rgba(255,255,255,0.28)', marginLeft: 4 }}>/ {gRow.uniqueLast}</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TableCard>
        </div>

      </div>
    </div>
  )
}

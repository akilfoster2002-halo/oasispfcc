'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, X, Calendar as CalIcon, CheckSquare as CheckIcon, Trash2 } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import Link from 'next/link'

const PALETTE = [
  '#C9A84C', '#34d399', '#fbbf24', '#f472b6',
  '#38bdf8', '#a78bfa', '#fb923c', '#2dd4bf',
]

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Group { id: string; name: string; color: string }

interface CalEvent {
  id: string
  name: string
  event_date: string
  event_datetime: string | null
  service_type: string
  group_id: string | null
  group_name: string
  color: string
  attendanceCount: number
}

function fmtTime(dt: string | null): string {
  if (!dt) return ''
  const d = new Date(dt)
  const h = d.getHours() % 12 || 12
  const m = d.getMinutes()
  const ampm = d.getHours() >= 12 ? 'pm' : 'am'
  return m === 0 ? `${h}${ampm}` : `${h}:${String(m).padStart(2, '0')}${ampm}`
}

export default function CalendarPage() {
  const params = useParams()
  const slug = params?.slug as string

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [churchId, setChurchId] = useState<string | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [events, setEvents] = useState<CalEvent[]>([])
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<CalEvent | null>(null)
  const [overflowDay, setOverflowDay] = useState<{ dateStr: string; evs: CalEvent[] } | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function deleteEvent(ev: CalEvent) {
    setDeleting(true)
    try {
      await getSupabaseBrowser().from('events').delete().eq('id', ev.id)
      setEvents(prev => prev.filter(e => e.id !== ev.id))
      setSelected(null)
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    getSupabaseBrowser()
      .from('churches')
      .select('id')
      .eq('slug', slug)
      .single()
      .then(({ data }) => data && setChurchId(data.id))
  }, [slug])

  useEffect(() => {
    if (!churchId) return
    getSupabaseBrowser()
      .from('groups')
      .select('id, name')
      .eq('church_id', churchId)
      .order('name')
      .then(({ data }) =>
        setGroups(
          (data ?? []).map((g, i) => ({
            id: g.id,
            name: g.name,
            color: PALETTE[i % PALETTE.length],
          }))
        )
      )
  }, [churchId])

  const loadEvents = useCallback(() => {
    if (!churchId) return
    const lastDay = new Date(year, month + 1, 0).getDate()
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const to   = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    getSupabaseBrowser()
      .from('events')
      .select('id, name, event_date, event_datetime, service_type, group_id, attendance(count)')
      .eq('church_id', churchId)
      .gte('event_date', from)
      .lte('event_date', to)
      .order('event_date')
      .order('event_datetime', { nullsFirst: false })
      .then(({ data }) => {
        const gMap = new Map(groups.map(g => [g.id, g]))
        setEvents(
          (data ?? []).map(e => {
            const g = e.group_id ? gMap.get(e.group_id) : undefined
            const attArr = (e as Record<string, unknown>).attendance as { count: string }[] | null
            const attendanceCount = attArr && attArr.length > 0 ? parseInt(attArr[0].count) : 0
            return {
              id: e.id,
              name: e.name,
              event_date: e.event_date,
              event_datetime: e.event_datetime,
              service_type: e.service_type,
              group_id: e.group_id,
              group_name: g?.name ?? 'General',
              color: g?.color ?? 'rgba(255,255,255,0.35)',
              attendanceCount,
            }
          })
        )
      })
  }, [churchId, year, month, groups])

  useEffect(() => { loadEvents() }, [loadEvents])

  const eventsMap = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const ev of events) {
      if (hidden.has(ev.group_id ?? '__none__')) continue
      if (!map.has(ev.event_date)) map.set(ev.event_date, [])
      map.get(ev.event_date)!.push(ev)
    }
    return map
  }, [events, hidden])

  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }
  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  const toggleGroup = (gid: string) =>
    setHidden(prev => {
      const next = new Set(prev)
      next.has(gid) ? next.delete(gid) : next.add(gid)
      return next
    })

  return (
    <div style={{ display: 'flex', overflow: 'hidden', height: '100dvh' }}>

      {/* ── Left panel ── */}
      <aside
        className="hidden lg:flex"
        style={{
          width: 196, flexShrink: 0, flexDirection: 'column',
          borderRight: '1px solid rgba(255,255,255,0.052)',
          background: 'rgba(255,255,255,0.015)',
          overflowY: 'auto',
        }}
      >
        {/* Mini calendar */}
        <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.042)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.80)' }}>
              {MONTHS[month].slice(0, 3)} {year}
            </span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button onClick={prevMonth}
                style={{ width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.40)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              ><ChevronLeft style={{ width: 12, height: 12 }} /></button>
              <button onClick={nextMonth}
                style={{ width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.40)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              ><ChevronRight style={{ width: 12, height: 12 }} /></button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, letterSpacing: '0.05em', paddingBottom: 4, color: 'rgba(255,255,255,0.25)' }}>{d}</div>
            ))}
            {cells.map((day, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '1' }}>
                {day !== null && (
                  <span style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 20, height: 20, borderRadius: '50%', fontSize: 10,
                    backgroundColor: isToday(day) ? '#A88A35' : 'transparent',
                    color: isToday(day) ? '#fff' : 'rgba(255,255,255,0.55)',
                    fontWeight: isToday(day) ? 700 : 400,
                  }}>{day}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ flex: 1, padding: 16 }}>
          <p className="text-label" style={{ marginBottom: 10 }}>Calendars</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {groups.map(g => {
              const isHidden = hidden.has(g.id)
              return (
                <button key={g.id} onClick={() => toggleGroup(g.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '5px 8px', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, backgroundColor: isHidden ? 'rgba(255,255,255,0.15)' : g.color }} />
                  <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isHidden ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.65)' }}>
                    {g.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </aside>

      {/* ── Main calendar ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.052)',
          background: 'rgba(255,255,255,0.015)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={prevMonth}
              style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.50)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            ><ChevronLeft style={{ width: 16, height: 16 }} /></button>
            <button onClick={nextMonth}
              style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.50)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            ><ChevronRight style={{ width: 16, height: 16 }} /></button>
            <button onClick={goToday}
              style={{ padding: '5px 12px', fontSize: 13, fontWeight: 500, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            >Today</button>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.88)', marginLeft: 4, letterSpacing: '-0.018em' }}>
              {MONTHS[month]} {year}
            </h2>
          </div>
          <Link href={`/${slug}/events/new`} className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
          ><Plus style={{ width: 14, height: 14 }} /> Add Event</Link>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.052)', background: 'rgba(255,255,255,0.015)', position: 'sticky', top: 0, zIndex: 10 }}>
            {WEEKDAYS.map(d => (
              <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(110px, auto)' }}>
            {cells.map((day, i) => {
              const dateStr = day
                ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                : ''
              const dayEvs = day ? (eventsMap.get(dateStr) ?? []) : []
              const current = day ? isToday(day) : false

              return (
                <div key={i} style={{ borderRight: '1px solid rgba(255,255,255,0.042)', borderBottom: '1px solid rgba(255,255,255,0.042)', padding: 4, backgroundColor: day ? 'transparent' : 'rgba(0,0,0,0.12)' }}>
                  {day !== null && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2, paddingRight: 2 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', fontSize: 12, backgroundColor: current ? '#A88A35' : 'transparent', color: current ? '#fff' : 'rgba(255,255,255,0.55)', fontWeight: current ? 700 : 500, boxShadow: current ? '0 0 10px rgba(201,168,76,0.40)' : 'none' }}>
                          {day}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {(dayEvs.length > 2 ? dayEvs.slice(0, 2) : dayEvs).map(ev => (
                          <div key={ev.id} style={{ position: 'relative' }}>
                            <button onClick={() => setSelected(ev)}
                              style={{ width: '100%', textAlign: 'left', padding: '2px 6px', borderRadius: 5, fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '20px', backgroundColor: `${ev.color}20`, color: ev.color, borderLeft: `2px solid ${ev.color}` }}
                              onMouseEnter={e => { setHoveredId(ev.id); e.currentTarget.style.opacity = '0.75' }}
                              onMouseLeave={e => { setHoveredId(null); e.currentTarget.style.opacity = '1' }}
                            >
                              {ev.event_datetime && <span style={{ marginRight: 4, fontWeight: 600, opacity: 0.80 }}>{fmtTime(ev.event_datetime)}</span>}
                              {ev.name}
                            </button>
                            {hoveredId === ev.id && (
                              <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, zIndex: 200, pointerEvents: 'none', background: 'rgba(8,12,28,0.96)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '4px 9px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.88)', whiteSpace: 'nowrap', backdropFilter: 'blur(12px)', boxShadow: '0 4px 16px rgba(0,0,0,0.50)' }}>
                                {ev.attendanceCount} checked in
                              </div>
                            )}
                          </div>
                        ))}
                        {dayEvs.length > 2 && (
                          <button
                            onClick={e => { e.stopPropagation(); setOverflowDay({ dateStr, evs: dayEvs }) }}
                            style={{ fontSize: 10, padding: '1px 6px', color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, cursor: 'pointer', margin: 0, lineHeight: '18px' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.80)'; e.currentTarget.style.background = 'rgba(255,255,255,0.09)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                          >+{dayEvs.length - 2} more</button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Day overflow modal ── */}
      {overflowDay && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={() => setOverflowDay(null)}
        >
          <div style={{ width: 340, maxHeight: '70vh', borderRadius: 22, overflow: 'hidden', background: 'linear-gradient(145deg, rgba(255,255,255,0.075) 0%, rgba(255,255,255,0.030) 100%)', backdropFilter: 'blur(40px) saturate(200%)', WebkitBackdropFilter: 'blur(40px) saturate(200%)', border: '1px solid rgba(255,255,255,0.090)', boxShadow: '0 1px 0 rgba(255,255,255,0.10) inset, 0 -1px 0 rgba(0,0,0,0.25) inset, 0 24px 64px rgba(0,0,0,0.50)', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.065)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.92)', margin: 0, letterSpacing: '-0.018em' }}>
                {new Date(overflowDay.dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              <button onClick={() => setOverflowDay(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: 0.45 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.45')}
              ><X style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.90)' }} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {overflowDay.evs.map(ev => (
                <button key={ev.id}
                  onClick={() => { setOverflowDay(null); setSelected(ev) }}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 12, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', background: `${ev.color}18`, borderLeft: `3px solid ${ev.color}`, color: 'rgba(255,255,255,0.85)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${ev.color}28`)}
                  onMouseLeave={e => (e.currentTarget.style.background = `${ev.color}18`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {ev.event_datetime && <span style={{ color: ev.color, fontWeight: 600, fontSize: 11, flexShrink: 0 }}>{fmtTime(ev.event_datetime)}</span>}
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</span>
                    {ev.attendanceCount > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: ev.color, flexShrink: 0, opacity: 0.80 }}>{ev.attendanceCount}</span>
                    )}
                  </div>
                  {ev.group_name !== 'General' && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)', marginTop: 2 }}>{ev.group_name}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Event popup ── */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={() => setSelected(null)}
        >
          <div style={{ width: 320, borderRadius: 22, overflow: 'hidden', background: 'linear-gradient(145deg, rgba(255,255,255,0.075) 0%, rgba(255,255,255,0.030) 100%)', backdropFilter: 'blur(40px) saturate(200%)', WebkitBackdropFilter: 'blur(40px) saturate(200%)', border: '1px solid rgba(255,255,255,0.090)', boxShadow: '0 1px 0 rgba(255,255,255,0.10) inset, 0 -1px 0 rgba(0,0,0,0.25) inset, 0 24px 64px rgba(0,0,0,0.50)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.065)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.92)', margin: 0, letterSpacing: '-0.018em' }}>{selected.name}</h3>
                  <p style={{ fontSize: 13, marginTop: 5, color: 'rgba(255,255,255,0.44)', margin: '5px 0 0' }}>
                    {new Date(selected.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    {selected.event_datetime && ` · ${fmtTime(selected.event_datetime)}`}
                  </p>
                  {selected.group_name !== 'General' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', marginTop: 8, padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500, backgroundColor: `${selected.color}20`, color: selected.color, border: `1px solid ${selected.color}40` }}>
                      {selected.group_name}
                    </span>
                  )}
                </div>
                <button onClick={() => setSelected(null)} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: 0.45 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.45')}
                ><X style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.90)' }} /></button>
              </div>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link href={`/${slug}/events/${selected.id}`} className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
                onClick={() => setSelected(null)}
              ><CalIcon style={{ width: 14, height: 14 }} /> View Details</Link>
              <Link href={`/${slug}/events/${selected.id}?checkin=1`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, textDecoration: 'none', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.20)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.12)')}
                onClick={() => setSelected(null)}
              ><CheckIcon style={{ width: 14, height: 14 }} /> Check In</Link>
              <button
                onClick={() => deleteEvent(selected)}
                disabled={deleting}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, border: '1px solid rgba(248,113,113,0.22)', background: 'rgba(248,113,113,0.08)', color: '#f87171', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1, transition: 'all 0.15s ease' }}
                onMouseEnter={e => !deleting && (e.currentTarget.style.background = 'rgba(248,113,113,0.16)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.08)')}
              ><Trash2 style={{ width: 14, height: 14 }} />{deleting ? 'Deleting…' : 'Delete Event'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

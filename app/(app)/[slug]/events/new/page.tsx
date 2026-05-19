'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { generateOccurrences, describeRecurrence, RecurrenceRule } from '@/lib/recurrence'
import {
  ArrowLeft, Calendar, Clock, MapPin, Tag, RefreshCw,
  ChevronDown, ChevronUp, Info,
} from 'lucide-react'
import TimePicker, { addMinutes, timeBefore } from '@/components/TimePicker'

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_TYPES = [
  { value: 'sunday_inperson', label: 'Sunday Service (In-Person)' },
  { value: 'sunday_online',   label: 'Sunday Service (Online)' },
  { value: 'midweek',         label: 'Midweek Service' },
  { value: 'cell',            label: 'Cell Group' },
  { value: 'outreach',        label: 'Outreach' },
  { value: 'prayer',          label: 'Prayer Meeting' },
  { value: 'other',           label: 'Other' },
]

const WEEKDAY_LABELS = [
  { key: 'SUN', label: 'S', full: 'Sunday' },
  { key: 'MON', label: 'M', full: 'Monday' },
  { key: 'TUE', label: 'T', full: 'Tuesday' },
  { key: 'WED', label: 'W', full: 'Wednesday' },
  { key: 'THU', label: 'T', full: 'Thursday' },
  { key: 'FRI', label: 'F', full: 'Friday' },
  { key: 'SAT', label: 'S', full: 'Saturday' },
]

const today = new Date().toISOString().split('T')[0]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthlyLabel(dateStr: string, type: 'day_of_month' | 'day_of_week'): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDate()
  const weekdayName = d.toLocaleDateString('en-US', { weekday: 'long' })
  const weekNum = Math.floor((day - 1) / 7) + 1
  const ordinals = ['1st', '2nd', '3rd', '4th', '5th']
  if (type === 'day_of_month') return `Monthly on day ${day}`
  return `Monthly on the ${ordinals[weekNum - 1]} ${weekdayName}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
      <Icon style={{ width: 14, height: 14, flexShrink: 0, color: '#818cf8' }} />
      <h2 className="text-label">{title}</h2>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.56)' }}>
        {label}{required && <span style={{ marginLeft: 2, color: '#f87171' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NewEventPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string

  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [cells,  setCells]  = useState<{ id: string; name: string; color: string }[]>([])
  const [churchId, setChurchId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRecurrence, setShowRecurrence] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [serviceType, setServiceType] = useState('sunday_inperson')
  const [groupId, setGroupId] = useState('')
  const [cellId,  setCellId]  = useState('')
  const [allDay, setAllDay] = useState(false)
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('12:00')

  const [recurrence, setRecurrence] = useState<RecurrenceRule>({
    type: 'none',
    interval: 1,
    days: [],
    monthlyType: 'day_of_month',
    endType: 'never',
    endDate: '',
    endCount: 10,
  })

  const setR = (patch: Partial<RecurrenceRule>) =>
    setRecurrence(r => ({ ...r, ...patch }))

  const toggleDay = (key: string) =>
    setR({
      days: recurrence.days.includes(key)
        ? recurrence.days.filter(d => d !== key)
        : [...recurrence.days, key],
    })

  useEffect(() => {
    const load = async () => {
      const sb = getSupabaseBrowser()
      const { data: church } = await sb.from('churches').select('id').eq('slug', slug).single()
      if (!church) return
      setChurchId(church.id)
      const { data } = await sb.from('groups').select('id, name').eq('church_id', church.id).order('name')
      setGroups(data ?? [])
      const { data: cellData } = await sb.from('cells').select('id, name, color').eq('church_id', church.id).eq('is_active', true).order('name')
      setCells(cellData ?? [])
    }
    load()
  }, [slug])

  const occurrences = useMemo(() => {
    if (!date) return []
    return generateOccurrences(date, recurrence)
  }, [date, recurrence])

  const previewLabel = useMemo(() => {
    if (recurrence.type === 'none') return null
    const n = occurrences.length
    if (n === 0) return 'No events generated — check your settings'
    const last = occurrences[occurrences.length - 1]
    const lastFmt = new Date(last + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
    return `Will create ${n} event${n === 1 ? '' : 's'} · last on ${lastFmt}`
  }, [occurrences, recurrence.type])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!churchId || !name.trim() || !date) return
    setSaving(true)
    setError(null)

    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        church_id: churchId,
        name: name.trim(),
        description: description || undefined,
        location: location || undefined,
        service_type: serviceType,
        group_id: serviceType !== 'cell' ? (groupId || undefined) : undefined,
        cell_id: serviceType === 'cell' ? (cellId || undefined) : undefined,
        all_day: allDay,
        event_date: date,
        start_time: allDay ? undefined : startTime,
        end_time: allDay ? undefined : endTime,
        recurrence: recurrence.type !== 'none' ? recurrence : undefined,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      setSaving(false)
      return
    }

    if (data.first_id) {
      router.push(`/${slug}/events/${data.first_id}`)
    } else {
      router.push(`/${slug}/events`)
    }
  }

  const isRecurring = recurrence.type !== 'none'
  const submitLabel = saving
    ? (isRecurring ? `Creating ${occurrences.length} events…` : 'Creating…')
    : isRecurring
    ? `Create ${occurrences.length} Event${occurrences.length === 1 ? '' : 's'}`
    : 'Create Event'

  const cardStyle: React.CSSProperties = {
    background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)',
    backdropFilter: 'blur(32px) saturate(180%)',
    WebkitBackdropFilter: 'blur(32px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.065)',
    borderRadius: 20,
    boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 -1px 0 rgba(0,0,0,0.20) inset, 0 16px 48px rgba(0,0,0,0.35)',
    padding: 24,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.032)',
    border: '1px solid rgba(255,255,255,0.080)',
    color: 'rgba(255,255,255,0.88)',
    borderRadius: 12,
    padding: '10px 14px',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 672, margin: '0 auto', padding: '32px 16px' }}>

        <Link
          href={`/${slug}/events`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: 'rgba(255,255,255,0.44)',
            textDecoration: 'none', marginBottom: 24,
            transition: 'color 0.12s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.72)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.44)')}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          Back to Calendar
        </Link>

        <div style={{ marginBottom: 28 }}>
          <h1 className="text-display" style={{ marginBottom: 8 }}>New Event</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.44)', margin: 0 }}>
            Schedule a one-time or recurring event for your church.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: 12, fontSize: 14,
              background: 'rgba(248,113,113,0.10)',
              color: '#f87171',
              border: '1px solid rgba(248,113,113,0.20)',
            }}>
              {error}
            </div>
          )}

          {/* ── Details ── */}
          <div style={cardStyle}>
            <SectionHeader icon={Tag} title="Details" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Event Name" required>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Sunday Service"
                  style={inputStyle}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.50)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.10)'
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.080)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Add notes, agenda, or details…"
                  rows={3}
                  style={{ ...inputStyle, resize: 'none' }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.50)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.10)'
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.080)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
              </Field>
            </div>
          </div>

          {/* ── Date & Time ── */}
          <div style={cardStyle}>
            <SectionHeader icon={Clock} title="Date & Time" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* All-day toggle */}
              <button
                type="button"
                onClick={() => setAllDay(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'left' }}
              >
                <div style={{
                  width: 40, height: 24, borderRadius: 99, position: 'relative',
                  backgroundColor: allDay ? '#6366f1' : 'rgba(255,255,255,0.12)',
                  transition: 'background-color 0.15s ease', flexShrink: 0,
                }}>
                  <span style={{
                    position: 'absolute', top: 4, width: 16, height: 16,
                    borderRadius: '50%', background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.30)',
                    transition: 'left 0.15s ease',
                    left: allDay ? '22px' : '4px',
                  }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.72)' }}>All day</span>
              </button>

              {/* Date row */}
              <div style={{ display: 'grid', gridTemplateColumns: allDay ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
                <Field label="Date" required>
                  <div style={{ position: 'relative' }}>
                    <input
                      ref={dateInputRef}
                      type="date"
                      required
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      style={{ ...inputStyle, paddingRight: 40, colorScheme: 'dark' }}
                      onFocus={e => {
                        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.50)'
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.10)'
                      }}
                      onBlur={e => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.080)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => dateInputRef.current?.showPicker()}
                      tabIndex={-1}
                      style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: '#818cf8', padding: 0,
                      }}
                    >
                      <Calendar style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </Field>
                {!allDay && (
                  <>
                    <Field label="Start time">
                      <TimePicker
                        value={startTime}
                        onChange={v => {
                          setStartTime(v)
                          if (!timeBefore(v, endTime)) setEndTime(addMinutes(v, 60))
                        }}
                      />
                    </Field>
                    <Field label="End time">
                      <TimePicker
                        value={endTime}
                        onChange={v => {
                          if (!timeBefore(startTime, v)) return
                          setEndTime(v)
                        }}
                      />
                    </Field>
                  </>
                )}
              </div>

              {/* Location */}
              <Field label="Location">
                <div style={{ position: 'relative' }}>
                  <MapPin style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'rgba(255,255,255,0.28)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="Add a location or link…"
                    style={{ ...inputStyle, paddingLeft: 36 }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.50)'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.10)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.080)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>
              </Field>
            </div>
          </div>

          {/* ── Category ── */}
          <div style={cardStyle}>
            <SectionHeader icon={Calendar} title="Category" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Service Type">
                <select
                  value={serviceType}
                  onChange={e => setServiceType(e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                >
                  {SERVICE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
              {serviceType === 'cell' ? (
                <Field label="Cell">
                  <select
                    value={cellId}
                    onChange={e => setCellId(e.target.value)}
                    style={{ ...inputStyle, colorScheme: 'dark', color: cellId ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.30)' }}
                  >
                    <option value="">Select a cell…</option>
                    {cells.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Group">
                  <select
                    value={groupId}
                    onChange={e => setGroupId(e.target.value)}
                    style={{ ...inputStyle, colorScheme: 'dark', color: groupId ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.30)' }}
                  >
                    <option value="">No group</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          </div>

          {/* ── Recurrence ── */}
          <div style={{
            ...cardStyle,
            padding: 0,
            overflow: 'hidden',
          }}>

            {/* Header */}
            <button
              type="button"
              onClick={() => setShowRecurrence(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '20px 24px', textAlign: 'left',
                background: 'none', border: 'none', cursor: 'pointer',
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <RefreshCw style={{ width: 14, height: 14, flexShrink: 0, color: '#818cf8' }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.88)', margin: 0 }}>
                    Recurrence
                  </p>
                  <p style={{ fontSize: 12, marginTop: 2, margin: 0, color: isRecurring ? '#818cf8' : 'rgba(255,255,255,0.30)' }}>
                    {isRecurring ? describeRecurrence(recurrence, date) : 'Does not repeat'}
                  </p>
                </div>
              </div>
              {showRecurrence
                ? <ChevronUp style={{ width: 14, height: 14, flexShrink: 0, color: 'rgba(255,255,255,0.28)' }} />
                : <ChevronDown style={{ width: 14, height: 14, flexShrink: 0, color: 'rgba(255,255,255,0.28)' }} />}
            </button>

            {showRecurrence && (
              <div style={{ padding: '0 24px 24px', borderTop: '1px solid rgba(255,255,255,0.055)', display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* Repeat type */}
                <div style={{ paddingTop: 20 }}>
                  <p className="text-label" style={{ marginBottom: 12 }}>Repeat</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['none', 'daily', 'weekly', 'monthly'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setR({ type: t })}
                        style={{
                          padding: '8px 16px', borderRadius: 12, fontSize: 13, fontWeight: 500,
                          border: 'none', cursor: 'pointer', transition: 'all 0.12s ease',
                          backgroundColor: recurrence.type === t ? '#6366f1' : 'rgba(255,255,255,0.06)',
                          color: recurrence.type === t ? '#fff' : 'rgba(255,255,255,0.55)',
                          boxShadow: recurrence.type === t ? '0 2px 8px rgba(99,102,241,0.35)' : 'none',
                        }}
                      >
                        {t === 'none' ? 'None' : t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interval */}
                {recurrence.type !== 'none' && (
                  <div>
                    <p className="text-label" style={{ marginBottom: 12 }}>Frequency</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>Every</span>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={recurrence.interval}
                        onChange={e => setR({ interval: Math.max(1, parseInt(e.target.value) || 1) })}
                        style={{
                          width: 56, padding: '6px 8px', textAlign: 'center', fontSize: 13,
                          background: 'rgba(255,255,255,0.032)', border: '1px solid rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.88)', borderRadius: 10, outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>
                        {recurrence.type === 'daily'   && (recurrence.interval === 1 ? 'day' : 'days')}
                        {recurrence.type === 'weekly'  && (recurrence.interval === 1 ? 'week' : 'weeks')}
                        {recurrence.type === 'monthly' && (recurrence.interval === 1 ? 'month' : 'months')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Weekly day picker */}
                {recurrence.type === 'weekly' && (
                  <div>
                    <p className="text-label" style={{ marginBottom: 12 }}>On days</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {WEEKDAY_LABELS.map(({ key, label, full }) => {
                        const active = recurrence.days.includes(key)
                        return (
                          <button
                            key={key}
                            type="button"
                            title={full}
                            onClick={() => toggleDay(key)}
                            style={{
                              width: 36, height: 36, borderRadius: 10, fontSize: 12, fontWeight: 700,
                              border: 'none', cursor: 'pointer', transition: 'all 0.12s ease',
                              backgroundColor: active ? '#6366f1' : 'rgba(255,255,255,0.06)',
                              color: active ? '#fff' : 'rgba(255,255,255,0.40)',
                              boxShadow: active ? '0 2px 6px rgba(99,102,241,0.30)' : 'none',
                            }}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    {recurrence.days.length === 0 && (
                      <p style={{ fontSize: 12, marginTop: 8, color: 'rgba(255,255,255,0.28)', margin: '8px 0 0' }}>
                        No days selected — will default to the event start day
                      </p>
                    )}
                  </div>
                )}

                {/* Monthly type */}
                {recurrence.type === 'monthly' && (
                  <div>
                    <p className="text-label" style={{ marginBottom: 12 }}>Repeat on</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(['day_of_month', 'day_of_week'] as const).map(t => (
                        <label
                          key={t}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                            border: `1px solid ${recurrence.monthlyType === t ? 'rgba(99,102,241,0.50)' : 'rgba(255,255,255,0.08)'}`,
                            background: recurrence.monthlyType === t ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          <input
                            type="radio"
                            name="monthlyType"
                            checked={recurrence.monthlyType === t}
                            onChange={() => setR({ monthlyType: t })}
                            style={{ accentColor: '#6366f1' }}
                          />
                          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)' }}>
                            {monthlyLabel(date, t)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* End condition */}
                {recurrence.type !== 'none' && (
                  <div>
                    <p className="text-label" style={{ marginBottom: 12 }}>Ends</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                      <label style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                        border: `1px solid ${recurrence.endType === 'never' ? 'rgba(99,102,241,0.50)' : 'rgba(255,255,255,0.08)'}`,
                        background: recurrence.endType === 'never' ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                        transition: 'all 0.12s ease',
                      }}>
                        <input type="radio" name="endType" checked={recurrence.endType === 'never'} onChange={() => setR({ endType: 'never' })} style={{ accentColor: '#6366f1' }} />
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', flex: 1 }}>Never</span>
                        {recurrence.endType === 'never' && (
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)' }}>up to 2 years</span>
                        )}
                      </label>

                      <label style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                        border: `1px solid ${recurrence.endType === 'on_date' ? 'rgba(99,102,241,0.50)' : 'rgba(255,255,255,0.08)'}`,
                        background: recurrence.endType === 'on_date' ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                        transition: 'all 0.12s ease',
                      }}>
                        <input type="radio" name="endType" checked={recurrence.endType === 'on_date'} onChange={() => setR({ endType: 'on_date' })} style={{ accentColor: '#6366f1' }} />
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', flexShrink: 0 }}>On date</span>
                        <div style={{ marginLeft: 'auto', position: 'relative' }} onClick={e => e.stopPropagation()}>
                          <input
                            type="date"
                            value={recurrence.endDate}
                            onChange={e => setR({ endDate: e.target.value, endType: 'on_date' })}
                            min={date}
                            id="end-date-input"
                            style={{
                              fontSize: 13, borderRadius: 8, padding: '4px 32px 4px 8px',
                              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                              color: 'rgba(255,255,255,0.80)', outline: 'none', colorScheme: 'dark',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => (document.getElementById('end-date-input') as HTMLInputElement)?.showPicker()}
                            tabIndex={-1}
                            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#818cf8', padding: 0 }}
                          >
                            <Calendar style={{ width: 13, height: 13 }} />
                          </button>
                        </div>
                      </label>

                      <label style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                        border: `1px solid ${recurrence.endType === 'after_count' ? 'rgba(99,102,241,0.50)' : 'rgba(255,255,255,0.08)'}`,
                        background: recurrence.endType === 'after_count' ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                        transition: 'all 0.12s ease',
                      }}>
                        <input type="radio" name="endType" checked={recurrence.endType === 'after_count'} onChange={() => setR({ endType: 'after_count' })} style={{ accentColor: '#6366f1' }} />
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', flexShrink: 0 }}>After</span>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={recurrence.endCount}
                          onChange={e => setR({ endCount: Math.max(1, parseInt(e.target.value) || 1), endType: 'after_count' })}
                          style={{
                            width: 56, fontSize: 13, textAlign: 'center', padding: '4px 8px',
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                            color: 'rgba(255,255,255,0.80)', borderRadius: 8, outline: 'none',
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', flexShrink: 0 }}>occurrences</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Live preview */}
                {previewLabel && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 16px', borderRadius: 12, fontSize: 13,
                    background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(129,140,248,0.25)',
                  }}>
                    <Info style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1, color: '#818cf8' }} />
                    <span style={{ color: 'rgba(165,180,252,0.90)' }}>{previewLabel}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Submit ── */}
          <div style={{ display: 'flex', gap: 12, paddingBottom: 32 }}>
            <button
              type="submit"
              disabled={saving || !name.trim() || !date || (isRecurring && occurrences.length === 0)}
              className="btn-primary"
              style={{
                flex: 1, padding: '12px 0', borderRadius: 14, fontSize: 14, fontWeight: 600,
              }}
            >
              {submitLabel}
            </button>
            <Link
              href={`/${slug}/events`}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 14, fontSize: 14, fontWeight: 500,
                textAlign: 'center', textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.55)',
                background: 'rgba(255,255,255,0.04)',
                transition: 'background 0.12s ease, color 0.12s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                e.currentTarget.style.color = 'rgba(255,255,255,0.80)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
              }}
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

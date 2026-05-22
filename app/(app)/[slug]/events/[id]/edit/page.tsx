'use client'

import { use, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import {
  ArrowLeft, Calendar, Clock, MapPin, Tag, BarChart2,
} from 'lucide-react'
import TimePicker, { addMinutes, timeBefore } from '@/components/TimePicker'

const SERVICE_TYPES = [
  { value: 'sunday_inperson', label: 'Sunday Service (In-Person)' },
  { value: 'sunday_online',   label: 'Sunday Service (Online)' },
  { value: 'midweek',         label: 'Midweek Service' },
  { value: 'cell',            label: 'Cell Group' },
  { value: 'outreach',        label: 'Outreach' },
  { value: 'prayer',          label: 'Prayer Meeting' },
  { value: 'other',           label: 'Other' },
]

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)',
  backdropFilter: 'blur(32px) saturate(180%)',
  WebkitBackdropFilter: 'blur(32px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.065)',
  borderRadius: 20,
  boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 -1px 0 rgba(0,0,0,0.20) inset, 0 16px 48px rgba(0,0,0,0.35)',
  padding: 24,
}

const inputBase: React.CSSProperties = {
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

function focusIn(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'rgba(201,168,76,0.50)'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.10)'
}
function focusOut(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.080)'
  e.currentTarget.style.boxShadow = 'none'
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
      <Icon style={{ width: 14, height: 14, flexShrink: 0, color: '#C9A84C' }} />
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

function NumericField({ label, value, onChange, min = 0 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number
}) {
  const btnStyle: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 8, fontSize: 18, fontWeight: 400,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.65)', cursor: 'pointer', transition: 'background 0.12s ease',
    flexShrink: 0,
  }
  return (
    <Field label={label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          style={btnStyle}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
        >
          −
        </button>
        <input
          type="number"
          min={min}
          value={value}
          onChange={e => onChange(Math.max(min, parseInt(e.target.value) || 0))}
          style={{
            width: 56, textAlign: 'center', padding: '6px 8px', fontSize: 13,
            background: 'rgba(255,255,255,0.032)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.88)', borderRadius: 8, outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          style={btnStyle}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
        >
          +
        </button>
      </div>
    </Field>
  )
}

export default function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: eventId } = use(params)
  const routeParams = useParams()
  const router = useRouter()
  const slug = routeParams?.slug as string

  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [cells,  setCells]  = useState<{ id: string; name: string; color: string }[]>([])
  const [loadingEvent, setLoadingEvent] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [serviceType, setServiceType] = useState('sunday_inperson')
  const [groupId, setGroupId] = useState('')
  const [cellId,  setCellId]  = useState('')
  const [allDay, setAllDay] = useState(false)
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  const [firstTimers, setFirstTimers] = useState(0)
  const [soulWon, setSoulWon] = useState(0)
  const [fsEnrolled, setFsEnrolled] = useState(0)
  const [substantiations, setSubstantiations] = useState(0)

  useEffect(() => {
    const load = async () => {
      const sb = getSupabaseBrowser()

      const { data: church } = await sb.from('churches').select('id').eq('slug', slug).single()
      if (church) {
        const { data: grps } = await sb.from('groups').select('id, name').eq('church_id', church.id).order('name')
        setGroups(grps ?? [])
        const { data: cellData } = await sb.from('cells').select('id, name, color').eq('church_id', church.id).eq('is_active', true).order('name')
        setCells(cellData ?? [])
      }

      const res = await fetch(`/api/events/${eventId}`)
      if (!res.ok) { setLoadingEvent(false); return }
      const ev = await res.json()

      setName(ev.name ?? '')
      setDescription(ev.description ?? '')
      setLocation(ev.location ?? '')
      setServiceType(ev.service_type ?? 'sunday_inperson')
      setGroupId(ev.group_id ?? '')
      setCellId(ev.cell_id ?? '')
      setAllDay(ev.all_day ?? false)
      setDate(ev.event_date ?? '')
      if (ev.event_datetime) {
        const t = new Date(ev.event_datetime)
        setStartTime(`${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`)
      }
      if (ev.event_end_datetime) {
        const t = new Date(ev.event_end_datetime)
        setEndTime(`${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`)
      }
      setFirstTimers(ev.first_timers ?? 0)
      setSoulWon(ev.soul_won ?? 0)
      setFsEnrolled(ev.fs_enrolled ?? 0)
      setSubstantiations(ev.substantiations ?? 0)

      setLoadingEvent(false)
    }
    load()
  }, [slug, eventId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !date) return
    setSaving(true)
    setError(null)

    const res = await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        description: description || null,
        location: location || null,
        service_type: serviceType,
        group_id: serviceType !== 'cell' ? (groupId || null) : null,
        cell_id: serviceType === 'cell' ? (cellId || null) : null,
        all_day: allDay,
        event_date: date,
        start_time: allDay ? null : startTime || null,
        end_time: allDay ? null : endTime || null,
        first_timers: firstTimers,
        soul_won: soulWon,
        fs_enrolled: fsEnrolled,
        substantiations,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      setSaving(false)
      return
    }

    router.push(`/${slug}/events/${eventId}`)
  }

  if (loadingEvent) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <div style={{ maxWidth: 672, margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="shimmer" style={{ height: 192, borderRadius: 20, background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 672, margin: '0 auto', padding: '32px 16px' }}>

        <Link
          href={`/${slug}/events/${eventId}`}
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
          Back to Event
        </Link>

        <div style={{ marginBottom: 28 }}>
          <h1 className="text-display" style={{ marginBottom: 8 }}>Edit Event</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.44)', margin: 0 }}>
            Changes apply to this occurrence only.
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
                  style={inputBase}
                  onFocus={focusIn}
                  onBlur={focusOut}
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  style={{ ...inputBase, resize: 'none' }}
                  onFocus={focusIn}
                  onBlur={focusOut}
                />
              </Field>
            </div>
          </div>

          {/* ── Date & Time ── */}
          <div style={cardStyle}>
            <SectionHeader icon={Clock} title="Date & Time" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <button
                type="button"
                onClick={() => setAllDay(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'left' }}
              >
                <div style={{
                  width: 40, height: 24, borderRadius: 99, position: 'relative',
                  backgroundColor: allDay ? '#A88A35' : 'rgba(255,255,255,0.12)',
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

              <div style={{ display: 'grid', gridTemplateColumns: allDay ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
                <Field label="Date" required>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      id="edit-date-input"
                      style={{ ...inputBase, paddingRight: 40, colorScheme: 'dark' }}
                      onFocus={focusIn}
                      onBlur={focusOut}
                    />
                    <button
                      type="button"
                      onClick={() => (document.getElementById('edit-date-input') as HTMLInputElement)?.showPicker()}
                      tabIndex={-1}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#C9A84C', padding: 0 }}
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

              <Field label="Location">
                <div style={{ position: 'relative' }}>
                  <MapPin style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'rgba(255,255,255,0.28)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="Add a location or link…"
                    style={{ ...inputBase, paddingLeft: 36 }}
                    onFocus={focusIn}
                    onBlur={focusOut}
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
                  style={{ ...inputBase, colorScheme: 'dark' }}
                  onFocus={focusIn}
                  onBlur={focusOut}
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
                    style={{ ...inputBase, colorScheme: 'dark', color: cellId ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.30)' }}
                    onFocus={focusIn}
                    onBlur={focusOut}
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
                    style={{ ...inputBase, colorScheme: 'dark', color: groupId ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.30)' }}
                    onFocus={focusIn}
                    onBlur={focusOut}
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

          {/* ── Metrics ── */}
          <div style={cardStyle}>
            <SectionHeader icon={BarChart2} title="Metrics" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 24px' }}>
              <NumericField label="First Timers"    value={firstTimers}    onChange={setFirstTimers} />
              <NumericField label="Soul Won"         value={soulWon}        onChange={setSoulWon} />
              <NumericField label="FS Enrolled"      value={fsEnrolled}     onChange={setFsEnrolled} />
              <NumericField label="Substantiations"  value={substantiations} onChange={setSubstantiations} />
            </div>
          </div>

          {/* ── Submit ── */}
          <div style={{ display: 'flex', gap: 12, paddingBottom: 32 }}>
            <button
              type="submit"
              disabled={saving || !name.trim() || !date}
              className="btn-primary"
              style={{
                flex: 1, padding: '12px 0', borderRadius: 14, fontSize: 14, fontWeight: 600,
              }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <Link
              href={`/${slug}/events/${eventId}`}
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

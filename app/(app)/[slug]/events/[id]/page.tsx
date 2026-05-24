'use client'

import { use, useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import {
  ArrowLeft, Users, Search, X, CheckCircle2, Circle, UserCheck,
  Pencil, UserPlus, FileText, ChevronDown, ChevronUp, ClipboardList,
  Copy, Check, Link2,
} from 'lucide-react'

interface EventRow {
  id: string
  name: string
  event_date: string
  event_datetime: string | null
  service_type: string
  group_id: string | null
  groups: { name: string } | null
}

interface Attendee {
  attendance_id: string
  person_id: string
  first_name: string
  last_name: string
  phone: string | null
  check_in_time: string | null
}

interface PersonResult {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  checked_in: boolean
  attendance_id?: string
}

interface FormOption {
  id: string
  name: string
  description: string | null
}

interface FormField {
  id: string
  type: string
  label: string
  required: boolean
  options?: string[]
}

interface FormResponse {
  id: string
  form_id: string | null
  form_name: string
  submitted_by: string | null
  responses: Record<string, string | number>
  created_at: string
  forms: { name: string; fields: FormField[] } | null
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}
function fmtTime(dt: string | null) {
  if (!dt) return null
  return new Date(dt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)',
  backdropFilter: 'blur(32px) saturate(180%)',
  WebkitBackdropFilter: 'blur(32px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.065)',
  borderRadius: 20,
  boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 -1px 0 rgba(0,0,0,0.20) inset, 0 16px 48px rgba(0,0,0,0.35)',
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params)
  const routeParams = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const slug = routeParams?.slug as string

  const [event, setEvent] = useState<EventRow | null>(null)
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [churchId, setChurchId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Forms / reports
  const [forms, setForms] = useState<FormOption[]>([])
  const [responses, setResponses] = useState<FormResponse[]>([])
  const [formPickerOpen, setFormPickerOpen] = useState(false)
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null)
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null)

  const [panelOpen, setPanelOpen] = useState(searchParams.get('checkin') === '1')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PersonResult[]>([])
  const [searching, setSearching] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

  const [addingNew, setAddingNew] = useState(false)
  const [newFirst, setNewFirst] = useState('')
  const [newLast, setNewLast] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const sb = getSupabaseBrowser()
      const { data: church } = await sb.from('churches').select('id').eq('slug', slug).single()
      if (!church) { setLoading(false); return }
      setChurchId(church.id)

      const [{ data: ev }, { data: att }] = await Promise.all([
        sb
          .from('events')
          .select('id, name, event_date, event_datetime, service_type, group_id, groups(name)')
          .eq('id', eventId)
          .single(),
        sb
          .from('attendance')
          .select('id, person_id, check_in_time, people(first_name, last_name, phone)')
          .eq('event_id', eventId)
          .eq('attendance_status', 'present')
          .order('check_in_time', { ascending: false }),
      ])

      setEvent(ev as unknown as EventRow)
      setAttendees(
        (att ?? []).map((a: any) => ({
          attendance_id: a.id,
          person_id: a.person_id,
          first_name: a.people?.first_name ?? '',
          last_name: a.people?.last_name ?? '',
          phone: a.people?.phone ?? null,
          check_in_time: a.check_in_time,
        }))
      )

      // Load forms + responses in parallel
      const [formsRes, responsesRes] = await Promise.all([
        fetch(`/api/forms?church_id=${church.id}`),
        fetch(`/api/events/${eventId}/responses`),
      ])
      if (formsRes.ok) setForms(await formsRes.json())
      if (responsesRes.ok) setResponses(await responsesRes.json())

      setLoading(false)
    }
    load()
  }, [slug, eventId])

  useEffect(() => {
    if (panelOpen) setTimeout(() => inputRef.current?.focus(), 80)
  }, [panelOpen])

  const openAddNew = useCallback(() => {
    const parts = query.trim().split(/\s+/)
    setNewFirst(parts[0] ?? '')
    setNewLast(parts.slice(1).join(' ') ?? '')
    setNewPhone('')
    setAddError(null)
    setAddingNew(true)
  }, [query])

  useEffect(() => {
    clearTimeout(debounce.current)
    if (!panelOpen || !churchId || !query.trim()) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounce.current = setTimeout(async () => {
      const q = query.trim()
      const sb = getSupabaseBrowser()
      const { data } = await sb
        .from('people')
        .select('id, first_name, last_name, phone')
        .eq('church_id', churchId)
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .order('last_name')
        .limit(25)

      const checkedMap = new Map(attendees.map(a => [a.person_id, a.attendance_id]))
      setResults(
        (data ?? []).map(p => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          phone: p.phone,
          checked_in: checkedMap.has(p.id),
          attendance_id: checkedMap.get(p.id),
        }))
      )
      setSearching(false)
    }, 250)

    return () => clearTimeout(debounce.current)
  }, [query, panelOpen, churchId, attendees])

  // Fire-and-forget: create a first-timer follow-up draft if this is their first check-in
  const maybeCreateFollowUp = useCallback(async (
    sb: ReturnType<typeof getSupabaseBrowser>,
    personId: string,
    firstName: string,
    lastName: string,
    phone: string | null,
  ) => {
    if (!churchId || !event) return
    const { count } = await sb
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', personId)
    if (count !== 1) return // not their first time
    const name = `${firstName} ${lastName}`.trim()
    const dateLabel = new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const message = `Hi ${firstName}! We're so glad you joined us at ${event.name} on ${dateLabel}. It was great having you — we hope to see you again soon! God bless you.`
    await fetch('/api/follow-ups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        church_id: churchId,
        person_id: personId,
        person_name: name,
        phone,
        event_id: eventId,
        event_name: event.name,
        event_date: event.event_date,
        message,
      }),
    })
  }, [churchId, event, eventId])

  const toggleCheckIn = useCallback(async (person: PersonResult) => {
    if (!churchId || toggling) return
    setToggling(person.id)
    const sb = getSupabaseBrowser()

    if (person.checked_in && person.attendance_id) {
      await sb.from('attendance').delete().eq('id', person.attendance_id)
      setAttendees(prev => prev.filter(a => a.person_id !== person.id))
      setResults(prev =>
        prev.map(p => p.id === person.id
          ? { ...p, checked_in: false, attendance_id: undefined }
          : p
        )
      )
    } else {
      const now = new Date().toISOString()
      const { data } = await sb
        .from('attendance')
        .upsert(
          {
            church_id: churchId,
            event_id: eventId,
            person_id: person.id,
            attendance_status: 'present',
            check_in_time: now,
          },
          { onConflict: 'person_id,event_id' }
        )
        .select('id, check_in_time')
        .single()

      if (data) {
        setAttendees(prev => [
          {
            attendance_id: data.id,
            person_id: person.id,
            first_name: person.first_name,
            last_name: person.last_name,
            phone: person.phone,
            check_in_time: data.check_in_time,
          },
          ...prev,
        ])
        setResults(prev =>
          prev.map(p => p.id === person.id
            ? { ...p, checked_in: true, attendance_id: data.id }
            : p
          )
        )

        if (event?.group_id && event.groups?.name) {
          await sb
            .from('people')
            .update({ group_name: event.groups.name })
            .eq('id', person.id)
            .is('group_name', null)
        }

        // Auto-draft a thank-you if this is their first ever check-in
        maybeCreateFollowUp(sb, person.id, person.first_name, person.last_name, person.phone)
      }
    }

    setToggling(null)
  }, [churchId, eventId, toggling, event, maybeCreateFollowUp])

  const handleAddNew = useCallback(async () => {
    if (!churchId || !newFirst.trim()) return
    setAddSaving(true)
    setAddError(null)
    const sb = getSupabaseBrowser()

    const { data: person, error: personErr } = await sb
      .from('people')
      .insert({
        church_id: churchId,
        first_name: newFirst.trim(),
        last_name: newLast.trim(),
        phone: newPhone.trim() || null,
      })
      .select('id, first_name, last_name, phone')
      .single()

    if (personErr || !person) {
      setAddError(personErr?.message ?? 'Failed to create person')
      setAddSaving(false)
      return
    }

    const now = new Date().toISOString()
    const { data: att, error: attErr } = await sb
      .from('attendance')
      .insert({
        church_id: churchId,
        event_id: eventId,
        person_id: person.id,
        attendance_status: 'present',
        check_in_time: now,
      })
      .select('id, check_in_time')
      .single()

    if (attErr || !att) {
      setAddError(attErr?.message ?? 'Failed to check in')
      setAddSaving(false)
      return
    }

    setAttendees(prev => [{
      attendance_id: att.id,
      person_id: person.id,
      first_name: person.first_name,
      last_name: person.last_name,
      phone: person.phone,
      check_in_time: att.check_in_time,
    }, ...prev])

    if (event?.group_id && event.groups?.name) {
      await sb
        .from('people')
        .update({ group_name: event.groups.name })
        .eq('id', person.id)
    }

    // New person = always a first-timer
    maybeCreateFollowUp(sb, person.id, person.first_name, person.last_name, person.phone ?? null)

    setAddingNew(false)
    setNewFirst('')
    setNewLast('')
    setNewPhone('')
    setQuery('')
    setAddSaving(false)
  }, [churchId, eventId, newFirst, newLast, newPhone, event, maybeCreateFollowUp])

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="shimmer" style={{ height: 96, borderRadius: 20, background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    )
  }

  if (!event) {
    return (
      <div style={{ padding: 24 }}>
        <Link
          href={`/${slug}/events`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.44)', textDecoration: 'none', marginBottom: 24 }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} /> Back to Calendar
        </Link>
        <p style={{ color: 'rgba(255,255,255,0.44)' }}>Event not found.</p>
      </div>
    )
  }

  const dateObj = new Date(event.event_date + 'T12:00:00')

  const panelInputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.032)',
    border: '1px solid rgba(255,255,255,0.080)',
    color: 'rgba(255,255,255,0.88)',
    borderRadius: 10,
    padding: '8px 12px',
    fontSize: 13,
    outline: 'none',
  }

  return (
    <div style={{ display: 'flex', overflow: 'hidden', height: '100dvh' }}>

      {/* ── Main content ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: 24, maxWidth: 672 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <Link
              href={`/${slug}/events`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.44)', textDecoration: 'none', transition: 'color 0.12s ease' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.72)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.44)')}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} /> Back to Calendar
            </Link>
            <Link
              href={`/${slug}/events/${eventId}/edit`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                textDecoration: 'none',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.65)',
                transition: 'background 0.12s ease, color 0.12s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.10)'
                e.currentTarget.style.color = 'rgba(255,255,255,0.90)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
              }}
            >
              <Pencil style={{ width: 13, height: 13 }} />
              Edit
            </Link>
          </div>

          {/* Event header card */}
          <div style={{ ...cardStyle, padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
              <div style={{ width: 52, textAlign: 'center', flexShrink: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C9A84C', margin: 0 }}>
                  {dateObj.toLocaleDateString('en-US', { month: 'short' })}
                </p>
                <p style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.1, color: 'rgba(255,255,255,0.92)', margin: '2px 0', fontFamily: 'var(--font-display), system-ui' }}>
                  {dateObj.getDate()}
                </p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                  {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                </p>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,0.92)', margin: 0, letterSpacing: '-0.015em' }}>
                  {event.name}
                </h1>
                <p style={{ fontSize: 13, marginTop: 5, color: 'rgba(255,255,255,0.44)', margin: '5px 0 0' }}>
                  {fmtDate(event.event_date)}
                  {event.event_datetime && ` · ${fmtTime(event.event_datetime)}`}
                </p>
                {event.groups && (
                  <p style={{ fontSize: 12, marginTop: 3, color: 'rgba(255,255,255,0.28)', margin: '3px 0 0' }}>
                    {event.groups.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Attendance count card */}
          <div style={{ ...cardStyle, padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p className="text-kpi" style={{ margin: 0 }}>{attendees.length}</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.44)', marginTop: 6, margin: '6px 0 0' }}>
                  People Attended This Event
                </p>
              </div>
              <button
                onClick={() => { setPanelOpen(true); setAddingNew(false) }}
                className="btn-primary"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                }}
              >
                <UserCheck style={{ width: 15, height: 15 }} />
                Check In
              </button>
            </div>
          </div>

          {/* Attendees list */}
          {attendees.length > 0 && (
            <div style={{ ...cardStyle, overflow: 'hidden' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.055)',
              }}>
                <Users style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.35)' }} />
                <h2 style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.72)', margin: 0, flex: 1 }}>
                  Attendees
                </h2>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                  background: 'rgba(52,211,153,0.12)', color: '#34d399',
                }}>
                  {attendees.length}
                </span>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {attendees.map((a, i) => (
                  <li key={a.attendance_id} style={{ borderBottom: i < attendees.length - 1 ? '1px solid rgba(255,255,255,0.042)' : 'none' }}>
                    <Link
                      href={`/${slug}/people/${a.person_id}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 20px', textDecoration: 'none',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(201,168,76,0.30) 0%, rgba(201,168,76,0.20) 100%)',
                        border: '1px solid rgba(201,168,76,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, fontSize: 12, fontWeight: 600, color: '#C9A84C',
                      }}>
                        {(a.first_name[0] ?? '?')}{(a.last_name[0] ?? '')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.88)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.first_name} {a.last_name}
                        </p>
                        {a.phone && (
                          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.phone}
                          </p>
                        )}
                      </div>
                      {a.check_in_time && (
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', flexShrink: 0 }}>
                          {new Date(a.check_in_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Reports section ── */}
          <div style={{ marginTop: 16 }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClipboardList style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.35)' }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.60)' }}>
                  Reports {responses.length > 0 && `(${responses.length})`}
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setFormPickerOpen(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                    background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.22)',
                    color: '#C9A84C', cursor: 'pointer', transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.18)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.10)')}
                >
                  <FileText style={{ width: 13, height: 13 }} />
                  Submit Report
                </button>
                {/* Form picker dropdown */}
                {formPickerOpen && forms.length > 0 && (
                  <div style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: 6, zIndex: 20,
                    minWidth: 260, borderRadius: 14, padding: 6,
                    background: 'linear-gradient(145deg, rgba(14,16,28,0.98) 0%, rgba(10,12,24,0.99) 100%)',
                    backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.50)',
                  }}>
                    {forms.map(f => {
                      const wasCopied = copiedFormId === f.id
                      const formUrl = `${window.location.origin}/form/${f.id}?event=${eventId}`
                      return (
                        <div
                          key={f.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 9, transition: 'background 0.10s ease' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.045)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <button
                            onClick={() => { setFormPickerOpen(false); router.push(`/${slug}/events/${eventId}/report/${f.id}`) }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, flex: 1,
                              padding: '9px 10px 9px 12px', textAlign: 'left',
                              background: 'none', border: 'none', cursor: 'pointer',
                            }}
                          >
                            <FileText style={{ width: 13, height: 13, color: '#C9A84C', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.88)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                              {f.description && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.description}</p>}
                            </div>
                          </button>
                          {/* Copy shareable link */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              await navigator.clipboard.writeText(formUrl)
                              setCopiedFormId(f.id)
                              setTimeout(() => setCopiedFormId(null), 2000)
                            }}
                            title="Copy shareable link"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 30, height: 30, borderRadius: 7, flexShrink: 0, marginRight: 4,
                              background: wasCopied ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)',
                              border: `1px solid ${wasCopied ? 'rgba(52,211,153,0.22)' : 'rgba(255,255,255,0.08)'}`,
                              cursor: 'pointer', transition: 'all 0.12s ease',
                            }}
                          >
                            {wasCopied
                              ? <Check style={{ width: 12, height: 12, color: '#34d399' }} />
                              : <Copy style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.40)' }} />
                            }
                          </button>
                        </div>
                      )
                    })}
                    {/* Divider + public form note */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '4px 4px 2px', padding: '8px 8px 2px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Link2 style={{ width: 11, height: 11, color: 'rgba(255,255,255,0.22)', flexShrink: 0 }} />
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', margin: 0 }}>Copy icon sends a shareable form link</p>
                    </div>
                  </div>
                )}
                {formPickerOpen && forms.length === 0 && (
                  <div style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: 6, zIndex: 20,
                    minWidth: 200, borderRadius: 14, padding: 14,
                    background: 'rgba(14,16,28,0.98)', border: '1px solid rgba(255,255,255,0.10)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.50)',
                    fontSize: 13, color: 'rgba(255,255,255,0.40)', textAlign: 'center',
                  }}>
                    No forms yet.{' '}
                    <Link href={`/${slug}/forms`} style={{ color: '#C9A84C', textDecoration: 'none' }}>Create one →</Link>
                  </div>
                )}
              </div>
            </div>

            {/* Submitted responses */}
            {responses.length === 0 ? (
              <div style={{
                padding: '20px 24px', borderRadius: 16, textAlign: 'center',
                border: '1px dashed rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.25)', fontSize: 13,
              }}>
                No reports submitted yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {responses.map(r => {
                  const isExpanded = expandedResponse === r.id
                  const fields: FormField[] = r.forms?.fields ?? []
                  const fmtResp = (fieldId: string, val: string | number) => {
                    const f = fields.find(f => f.id === fieldId)
                    if (!f) return String(val)
                    if (f.type === 'number' && val === 0) return '0'
                    return String(val)
                  }
                  const submittedAt = new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

                  return (
                    <div key={r.id} style={{
                      background: 'linear-gradient(145deg, rgba(255,255,255,0.042) 0%, rgba(255,255,255,0.014) 100%)',
                      border: '1px solid rgba(255,255,255,0.055)', borderRadius: 16, overflow: 'hidden',
                    }}>
                      {/* Response header */}
                      <button
                        onClick={() => setExpandedResponse(isExpanded ? null : r.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.18)' }}>
                          <ClipboardList style={{ width: 14, height: 14, color: '#C9A84C' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.80)', margin: 0 }}>
                            {r.form_name}
                            {r.submitted_by && <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}> — {r.submitted_by}</span>}
                          </p>
                          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', margin: '2px 0 0' }}>{submittedAt}</p>
                        </div>
                        {isExpanded
                          ? <ChevronUp style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                          : <ChevronDown style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                        }
                      </button>

                      {/* Expanded answers */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.042)', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {fields.map(f => {
                            const val = r.responses[f.id]
                            if (val === undefined || val === '' || val === null) return null
                            return (
                              <div key={f.id}>
                                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', margin: '0 0 3px' }}>{f.label}</p>
                                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0, whiteSpace: 'pre-wrap' }}>{fmtResp(f.id, val)}</p>
                              </div>
                            )
                          })}
                          {/* Show any keys not in form schema */}
                          {Object.entries(r.responses)
                            .filter(([k]) => !fields.find(f => f.id === k))
                            .map(([k, v]) => (
                              <div key={k}>
                                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', margin: '0 0 3px' }}>{k}</p>
                                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>{String(v)}</p>
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {/* Close dropdown on outside click */}
          {formPickerOpen && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setFormPickerOpen(false)} />
          )}
        </div>
      </div>

      {/* ── Check-in slide panel ── */}
      {panelOpen && (
        <>
          {/* Backdrop (mobile) */}
          <div
            className="fixed inset-0 z-40 lg:hidden"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={() => { setPanelOpen(false); setQuery(''); setAddingNew(false) }}
          />
          <div
            className="fixed right-0 top-0 bottom-0 z-50 flex flex-col lg:relative lg:z-auto"
            style={{
              width: 320, flexShrink: 0,
              background: 'linear-gradient(180deg, rgba(5,8,16,0.980) 0%, rgba(4,6,14,0.995) 100%)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              borderLeft: '1px solid rgba(255,255,255,0.052)',
              boxShadow: '-4px 0 32px rgba(0,0,0,0.40)',
            }}
          >
            {/* Panel header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px', flexShrink: 0,
              borderBottom: '1px solid rgba(255,255,255,0.052)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCheck style={{ width: 14, height: 14, color: '#34d399' }} />
                <h2 style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.88)', margin: 0 }}>
                  {addingNew ? 'New Person' : 'Check In'}
                </h2>
              </div>
              <button
                onClick={() => {
                  if (addingNew) { setAddingNew(false) }
                  else { setPanelOpen(false); setQuery('') }
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: 0.5, transition: 'opacity 0.12s ease' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
              >
                <X style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.80)' }} />
              </button>
            </div>

            {/* ── Add new person form ── */}
            {addingNew ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.44)', marginBottom: 16 }}>
                  Create a new person and check them in immediately.
                </p>

                {addError && (
                  <div style={{
                    marginBottom: 12, padding: '8px 12px', borderRadius: 10, fontSize: 13,
                    background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.20)',
                  }}>
                    {addError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 5, color: 'rgba(255,255,255,0.50)' }}>
                      First Name <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <input
                      autoFocus
                      type="text"
                      value={newFirst}
                      onChange={e => setNewFirst(e.target.value)}
                      placeholder="First name"
                      style={panelInputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 5, color: 'rgba(255,255,255,0.50)' }}>Last Name</label>
                    <input
                      type="text"
                      value={newLast}
                      onChange={e => setNewLast(e.target.value)}
                      placeholder="Last name"
                      style={panelInputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 5, color: 'rgba(255,255,255,0.50)' }}>Phone (optional)</label>
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={e => setNewPhone(e.target.value)}
                      placeholder="Phone number"
                      style={panelInputStyle}
                    />
                  </div>

                  <button
                    onClick={handleAddNew}
                    disabled={addSaving || !newFirst.trim()}
                    className="btn-primary"
                    style={{ width: '100%', padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 600 }}
                  >
                    {addSaving ? 'Adding…' : 'Add & Check In'}
                  </button>
                  <button
                    onClick={() => setAddingNew(false)}
                    style={{
                      width: '100%', padding: '8px 0', borderRadius: 12, fontSize: 13, fontWeight: 500,
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.50)', cursor: 'pointer',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  >
                    Back to Search
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Search bar */}
                <div style={{ padding: '12px 16px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.042)' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.032)', border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <Search style={{ width: 13, height: 13, flexShrink: 0, color: 'rgba(255,255,255,0.28)' }} />
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Search by name…"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'rgba(255,255,255,0.88)' }}
                    />
                    {query && (
                      <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: 0.5 }}>
                        <X style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.80)' }} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Checked-in chips */}
                {!query && attendees.length > 0 && (
                  <div style={{
                    padding: '12px 16px', flexShrink: 0,
                    borderBottom: '1px solid rgba(255,255,255,0.042)',
                    background: 'rgba(255,255,255,0.012)',
                  }}>
                    <p className="text-label" style={{ marginBottom: 8 }}>Checked In ({attendees.length})</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {attendees.slice(0, 12).map(a => (
                        <span
                          key={a.attendance_id}
                          style={{
                            padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 500,
                            background: 'rgba(52,211,153,0.10)', color: '#34d399',
                            border: '1px solid rgba(52,211,153,0.18)',
                          }}
                        >
                          {a.first_name} {a.last_name[0]}.
                        </span>
                      ))}
                      {attendees.length > 12 && (
                        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>
                          +{attendees.length - 12} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Results */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {!query && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 144, textAlign: 'center', padding: '0 24px' }}>
                      <Search style={{ width: 28, height: 28, marginBottom: 8, color: 'rgba(255,255,255,0.12)' }} />
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)', margin: 0 }}>Type a name to find someone</p>
                    </div>
                  )}

                  {searching && (
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[1, 2, 3].map(i => (
                        <div key={i} className="shimmer" style={{ height: 48, borderRadius: 10, background: 'rgba(255,255,255,0.04)' }} />
                      ))}
                    </div>
                  )}

                  {!searching && query && results.length === 0 && (
                    <div style={{ padding: 20, textAlign: 'center' }}>
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>
                        No one found for &quot;{query}&quot;
                      </p>
                      <button
                        onClick={openAddNew}
                        className="btn-primary"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                        }}
                      >
                        <UserPlus style={{ width: 14, height: 14 }} />
                        Add &quot;{query}&quot; as New Person
                      </button>
                    </div>
                  )}

                  {!searching && results.map((person, i) => (
                    <button
                      key={person.id}
                      onClick={() => toggleCheckIn(person)}
                      disabled={toggling === person.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        width: '100%', padding: '12px 16px', textAlign: 'left',
                        background: 'none', border: 'none', cursor: 'pointer',
                        borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.042)' : 'none',
                        opacity: toggling === person.id ? 0.5 : 1,
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {person.checked_in ? (
                        <CheckCircle2 style={{ width: 18, height: 18, flexShrink: 0, color: '#34d399' }} />
                      ) : (
                        <Circle style={{ width: 18, height: 18, flexShrink: 0, color: 'rgba(255,255,255,0.18)' }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.88)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {person.first_name} {person.last_name}
                        </p>
                        {person.phone && (
                          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {person.phone}
                          </p>
                        )}
                      </div>
                      {person.checked_in && (
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, flexShrink: 0,
                          background: 'rgba(52,211,153,0.12)', color: '#34d399',
                          border: '1px solid rgba(52,211,153,0.20)',
                        }}>
                          ✓ In
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Add new person + Submit Report — bottom panel */}
                <div style={{ padding: '12px 16px', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.042)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    onClick={openAddNew}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '8px 12px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                      background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.20)',
                      color: '#34d399', cursor: 'pointer', transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.14)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.08)')}
                  >
                    <UserPlus style={{ width: 14, height: 14 }} />
                    Add New Person
                  </button>

                  {forms.length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.042)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', margin: '0 0 4px' }}>
                        Submit a Report
                      </p>
                      {forms.map(f => {
                        const formUrl = `/form/${f.id}?event=${eventId}`
                        return (
                          <a
                            key={f.id}
                            href={formUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '7px 10px', borderRadius: 9, fontSize: 13, fontWeight: 500,
                              textDecoration: 'none',
                              background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.16)',
                              color: '#C9A84C', transition: 'background 0.12s ease',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.13)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.07)')}
                          >
                            <FileText style={{ width: 13, height: 13, flexShrink: 0 }} />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                            <Link2 style={{ width: 11, height: 11, opacity: 0.4, flexShrink: 0 }} />
                          </a>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

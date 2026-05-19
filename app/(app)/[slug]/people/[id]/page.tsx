'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import {
  ArrowLeft, Calendar, Mail, Phone, MapPin, User,
  Users, BookOpen, Briefcase, Heart, ChevronRight,
  Archive, Pencil, Check, X, RotateCcw, Trash2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Person {
  id: string
  church_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  address: string | null
  gender: string | null
  birthdate: string | null
  group_name: string | null
  pastor: string | null
  designation: string | null
  cell_name: string | null
  fellowship: string | null
  who_invited: string | null
  joined_oasis: string | null
  baptized: string | null
  foundation_school: string | null
  foundation_school_grad_year: string | null
  school: string | null
  major: string | null
  profession: string | null
  marital_status: string | null
  state: string | null
  created_at: string
}

interface AttendanceRow {
  id: string
  check_in_time: string | null
  event: {
    id: string
    name: string
    event_date: string
    service_type: string
    groups: { name: string } | null
  } | null
}

type Tab = 'details' | 'attendance' | 'notes' | 'followups'

// ── Helpers ───────────────────────────────────────────────────────────────────

const PALETTE = ['#6366f1', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2']
function avatarColor(name: string) {
  let h = 0
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return PALETTE[Math.abs(h) % PALETTE.length]
}

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function fmtShortDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const SERVICE_LABELS: Record<string, string> = {
  sunday_inperson: 'Sunday',
  sunday_online: 'Sunday Online',
  midweek: 'Wednesday',
  cell: 'Cell',
  outreach: 'Outreach',
  prayer: 'Prayer',
  other: 'Other',
}

const SERVICE_COLORS: Record<string, { bg: string; text: string }> = {
  sunday_inperson: { bg: '#EEF2FF', text: '#4338CA' },
  sunday_online:   { bg: '#EEF2FF', text: '#4338CA' },
  midweek:         { bg: '#FFFBEB', text: '#92400E' },
  cell:            { bg: '#ECFDF5', text: '#065F46' },
  outreach:        { bg: '#FFF7ED', text: '#9A3412' },
  prayer:          { bg: '#F5F3FF', text: '#5B21B6' },
  other:           { bg: '#F9FAFB', text: '#374151' },
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-4 py-2.5" style={{ borderBottom: '1px solid #F3F4F6' }}>
      <span className="text-sm w-36 shrink-0" style={{ color: '#9CA3AF' }}>{label}</span>
      <span className="text-sm flex-1" style={{ color: value ? '#111827' : '#D1D5DB' }}>
        {value || '—'}
      </span>
    </div>
  )
}

function SectionCard({ title, icon: Icon, children }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid #E5E7EB' }}>
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E5E7EB' }}
      >
        <Icon className="w-4 h-4 shrink-0" style={{ color: '#6B7280' }} />
        <h3 className="text-sm font-semibold" style={{ color: '#374151' }}>{title}</h3>
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  )
}

// ── Inline edit for a single text field ──────────────────────────────────────

function EditableField({
  label, value, field, personId, onSaved,
}: {
  label: string
  value: string | null | undefined
  field: string
  personId: string
  onSaved: (field: string, value: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const sb = getSupabaseBrowser()
    await sb.from('people').update({ [field]: draft || null }).eq('id', personId)
    onSaved(field, draft || null)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-4 py-2.5" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <span className="text-sm w-36 shrink-0" style={{ color: '#9CA3AF' }}>{label}</span>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="flex-1 text-sm px-2 py-1 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200"
          style={{ border: '1px solid #6366f1', color: '#111827' }}
        />
        <button onClick={save} disabled={saving} className="hover:opacity-70 shrink-0">
          <Check className="w-4 h-4" style={{ color: '#059669' }} />
        </button>
        <button onClick={() => { setEditing(false); setDraft(value ?? '') }} className="hover:opacity-70 shrink-0">
          <X className="w-4 h-4" style={{ color: '#9CA3AF' }} />
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex items-start gap-4 py-2.5 group cursor-pointer hover:bg-gray-50 -mx-4 px-4 rounded transition-colors"
      style={{ borderBottom: '1px solid #F3F4F6' }}
      onClick={() => setEditing(true)}
    >
      <span className="text-sm w-36 shrink-0" style={{ color: '#9CA3AF' }}>{label}</span>
      <span className="text-sm flex-1" style={{ color: value ? '#111827' : '#D1D5DB' }}>
        {value || '—'}
      </span>
      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-40 shrink-0 mt-0.5 transition-opacity" style={{ color: '#6B7280' }} />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: personId } = use(params)
  const routeParams = useParams()
  const router = useRouter()
  const slug = routeParams?.slug as string

  const [person, setPerson] = useState<Person | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('details')
  const [attLoaded, setAttLoaded] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const sb = getSupabaseBrowser()
      const { data } = await sb
        .from('people')
        .select('*')
        .eq('id', personId)
        .single()
      setPerson(data as Person)
      setLoading(false)
    }
    load()
  }, [personId])

  // Lazy-load attendance when tab is selected
  useEffect(() => {
    if (tab !== 'attendance' || attLoaded) return
    const load = async () => {
      const sb = getSupabaseBrowser()
      const { data } = await sb
        .from('attendance')
        .select('id, check_in_time, event:events(id, name, event_date, service_type, groups(name))')
        .eq('person_id', personId)
        .eq('attendance_status', 'present')
        .order('check_in_time', { ascending: false })
        .limit(100)
      setAttendance((data ?? []) as unknown as AttendanceRow[])
      setAttLoaded(true)
    }
    load()
  }, [tab, personId, attLoaded])

  const onFieldSaved = useCallback((field: string, value: string | null) => {
    setPerson(prev => prev ? { ...prev, [field]: value } : prev)
  }, [])

  const handleArchive = async () => {
    if (!confirm('Archive this person? They will be hidden from the active list but can be restored.')) return
    setArchiving(true)
    const sb = getSupabaseBrowser()
    await sb.from('people').update({ designation: 'archived' }).eq('id', personId)
    setPerson(prev => prev ? { ...prev, designation: 'archived' } : prev)
    setArchiving(false)
  }

  const handleRestore = async () => {
    setArchiving(true)
    const sb = getSupabaseBrowser()
    await sb.from('people').update({ designation: null }).eq('id', personId)
    setPerson(prev => prev ? { ...prev, designation: null } : prev)
    setArchiving(false)
  }

  const handleDelete = async () => {
    if (!confirm(`Permanently delete ${person?.first_name} ${person?.last_name}? This cannot be undone and removes all their attendance records.`)) return
    setDeleting(true)
    const sb = getSupabaseBrowser()
    await sb.from('people').delete().eq('id', personId)
    router.push(`/${slug}/people`)
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'details',   label: 'Details',    icon: User },
    { id: 'attendance',label: 'Attendance', icon: Calendar },
    { id: 'notes',     label: 'Notes',      icon: BookOpen },
    { id: 'followups', label: 'Follow Ups', icon: ChevronRight },
  ]

  if (loading) {
    return (
      <div className="min-h-screen p-8" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="max-w-5xl mx-auto space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: '#E5E7EB' }} />
          ))}
        </div>
      </div>
    )
  }

  if (!person) {
    return (
      <div className="p-8">
        <Link href={`/${slug}/people`} className="inline-flex items-center gap-2 text-sm mb-6 hover:opacity-70" style={{ color: '#6B7280' }}>
          <ArrowLeft className="w-4 h-4" /> Back to People
        </Link>
        <p style={{ color: '#6B7280' }}>Person not found.</p>
      </div>
    )
  }

  const fullName = `${person.first_name} ${person.last_name}`.trim()
  const color = avatarColor(fullName)
  const attCount = attLoaded ? attendance.length : null

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>

      {/* ── Left sidebar ── */}
      <div
        className="hidden md:flex flex-col shrink-0 pt-8"
        style={{ width: 200, backgroundColor: '#FFFFFF', borderRight: '1px solid #E5E7EB', minHeight: '100vh' }}
      >
        <Link
          href={`/${slug}/people`}
          className="flex items-center gap-2 text-xs px-4 py-2 mb-4 hover:opacity-70 transition-opacity"
          style={{ color: '#9CA3AF' }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> All People
        </Link>

        <nav className="flex flex-col gap-0.5 px-2">
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors w-full"
                style={{
                  backgroundColor: active ? '#EEF2FF' : 'transparent',
                  color: active ? '#4338CA' : '#6B7280',
                  fontWeight: active ? 600 : 400,
                }}
              >
                <t.icon className="w-4 h-4 shrink-0" />
                {t.label}
                {t.id === 'attendance' && attLoaded && (
                  <span
                    className="ml-auto text-xs px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: active ? '#C7D2FE' : '#F3F4F6', color: active ? '#4338CA' : '#9CA3AF' }}
                  >
                    {attCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Mobile tab bar */}
        <div
          className="flex md:hidden gap-0 overflow-x-auto border-b sticky top-0 z-10"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}
        >
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors"
              style={{
                borderColor: tab === t.id ? '#4338CA' : 'transparent',
                color: tab === t.id ? '#4338CA' : '#6B7280',
              }}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 md:p-8 max-w-4xl">

          {/* ── Profile header ── */}
          <div
            className="bg-white rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-start gap-6"
            style={{ border: '1px solid #E5E7EB' }}
          >
            {/* Avatar */}
            <div
              className="w-24 h-24 rounded-2xl flex items-center justify-center shrink-0 text-2xl font-bold text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              {initials(person.first_name, person.last_name)}
            </div>

            {/* Name + actions */}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold mb-1" style={{ color: '#111827' }}>{fullName || 'Unnamed'}</h1>

              {/* Contact badges */}
              <div className="flex flex-wrap items-center gap-3 mt-2">
                {person.phone && (
                  <a
                    href={`tel:${person.phone}`}
                    className="inline-flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
                    style={{ color: '#6B7280' }}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {person.phone}
                  </a>
                )}
                {person.email && (
                  <a
                    href={`mailto:${person.email}`}
                    className="inline-flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
                    style={{ color: '#6B7280' }}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {person.email}
                  </a>
                )}
                {person.address && (
                  <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: '#6B7280' }}>
                    <MapPin className="w-3.5 h-3.5" />
                    {person.address}
                  </span>
                )}
                {!person.phone && !person.email && !person.address && (
                  <span className="text-sm" style={{ color: '#D1D5DB' }}>No contact information available.</span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 mt-4">
                {person.designation !== 'archived' ? (
                  <button
                    onClick={handleArchive}
                    disabled={archiving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-gray-100 disabled:opacity-50"
                    style={{ border: '1px solid #E5E7EB', color: '#6B7280', backgroundColor: '#FFFFFF' }}
                  >
                    <Archive className="w-3.5 h-3.5" />
                    {archiving ? 'Archiving…' : 'Archive Person'}
                  </button>
                ) : (
                  <>
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}
                    >
                      <Archive className="w-3.5 h-3.5" />
                      Archived
                    </span>
                    <button
                      onClick={handleRestore}
                      disabled={archiving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      style={{ backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#D1FAE5')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#ECFDF5')}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {archiving ? 'Restoring…' : 'Restore'}
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FEE2E2')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {deleting ? 'Deleting…' : 'Delete Permanently'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Details tab ── */}
          {tab === 'details' && (
            <div className="grid md:grid-cols-2 gap-4">

              {/* Left column */}
              <div>
                <SectionCard title="Profile" icon={User}>
                  <EditableField label="First Name"  value={person.first_name}  field="first_name"  personId={personId} onSaved={onFieldSaved} />
                  <EditableField label="Last Name"   value={person.last_name}   field="last_name"   personId={personId} onSaved={onFieldSaved} />
                  <EditableField label="Email"       value={person.email}       field="email"       personId={personId} onSaved={onFieldSaved} />
                  <EditableField label="Phone"       value={person.phone}       field="phone"       personId={personId} onSaved={onFieldSaved} />
                  <EditableField label="Gender"      value={person.gender}      field="gender"      personId={personId} onSaved={onFieldSaved} />
                  <EditableField label="Birthdate"   value={person.birthdate}   field="birthdate"   personId={personId} onSaved={onFieldSaved} />
                  <InfoRow      label="Member Since" value={fmtDate(person.created_at)} />
                </SectionCard>

                <SectionCard title="Group" icon={Users}>
                  <EditableField label="Group"       value={person.group_name}  field="group_name"  personId={personId} onSaved={onFieldSaved} />
                  <EditableField label="Cell"        value={person.cell_name}   field="cell_name"   personId={personId} onSaved={onFieldSaved} />
                  <EditableField label="Fellowship"  value={person.fellowship}  field="fellowship"  personId={personId} onSaved={onFieldSaved} />
                  <EditableField label="Pastor"      value={person.pastor}      field="pastor"      personId={personId} onSaved={onFieldSaved} />
                  <EditableField label="Designation" value={person.designation === 'archived' ? null : person.designation} field="designation" personId={personId} onSaved={onFieldSaved} />
                </SectionCard>

                <SectionCard title="Church Journey" icon={Heart}>
                  <EditableField label="Joined Oasis"    value={person.joined_oasis}              field="joined_oasis"              personId={personId} onSaved={onFieldSaved} />
                  <EditableField label="Invited By"      value={person.who_invited}               field="who_invited"               personId={personId} onSaved={onFieldSaved} />
                  <EditableField label="Baptized"        value={person.baptized}                  field="baptized"                  personId={personId} onSaved={onFieldSaved} />
                  <EditableField label="Foundation School" value={person.foundation_school}       field="foundation_school"         personId={personId} onSaved={onFieldSaved} />
                  <EditableField label="FS Grad Year"    value={person.foundation_school_grad_year} field="foundation_school_grad_year" personId={personId} onSaved={onFieldSaved} />
                </SectionCard>
              </div>

              {/* Right column */}
              <div>
                <SectionCard title="Education & Work" icon={Briefcase}>
                  <EditableField label="School"     value={person.school}      field="school"      personId={personId} onSaved={onFieldSaved} />
                  <EditableField label="Major"      value={person.major}       field="major"       personId={personId} onSaved={onFieldSaved} />
                  <EditableField label="Profession" value={person.profession}  field="profession"  personId={personId} onSaved={onFieldSaved} />
                </SectionCard>

                <SectionCard title="Other" icon={MapPin}>
                  <EditableField label="Marital Status" value={person.marital_status} field="marital_status" personId={personId} onSaved={onFieldSaved} />
                  <EditableField label="State"          value={person.state}          field="state"          personId={personId} onSaved={onFieldSaved} />
                  <EditableField label="Address"        value={person.address}        field="address"        personId={personId} onSaved={onFieldSaved} />
                </SectionCard>
              </div>
            </div>
          )}

          {/* ── Attendance tab ── */}
          {tab === 'attendance' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold" style={{ color: '#111827' }}>
                  Attendance History
                </h2>
                {attLoaded && (
                  <span className="text-sm" style={{ color: '#9CA3AF' }}>
                    {attendance.length} event{attendance.length !== 1 ? 's' : ''} attended
                  </span>
                )}
              </div>

              {!attLoaded ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: '#E5E7EB' }} />
                  ))}
                </div>
              ) : attendance.length === 0 ? (
                <div
                  className="rounded-xl py-16 text-center"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}
                >
                  <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
                  <p className="text-sm font-medium" style={{ color: '#9CA3AF' }}>No attendance recorded yet</p>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
                  {attendance.map((a, i) => {
                    const ev = a.event
                    if (!ev) return null
                    const svc = ev.service_type ?? 'other'
                    const chip = SERVICE_COLORS[svc] ?? SERVICE_COLORS.other
                    return (
                      <Link
                        key={a.id}
                        href={`/${slug}/events/${ev.id}`}
                        className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50"
                        style={i < attendance.length - 1 ? { borderBottom: '1px solid #F3F4F6' } : {}}
                      >
                        {/* Date block */}
                        <div className="w-12 text-center shrink-0">
                          <p className="text-xs font-semibold uppercase" style={{ color: '#4068E2' }}>
                            {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })}
                          </p>
                          <p className="text-xl font-bold leading-tight" style={{ color: '#111827' }}>
                            {new Date(ev.event_date + 'T12:00:00').getDate()}
                          </p>
                          <p className="text-[10px]" style={{ color: '#9CA3AF' }}>
                            {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                          </p>
                        </div>

                        {/* Event info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: '#111827' }}>{ev.name}</p>
                          <p className="text-xs mt-0.5 truncate" style={{ color: '#9CA3AF' }}>
                            {ev.groups?.name ?? 'No group'}
                          </p>
                        </div>

                        {/* Service type chip */}
                        <span
                          className="text-xs font-medium px-2.5 py-1 rounded-full shrink-0"
                          style={{ backgroundColor: chip.bg, color: chip.text }}
                        >
                          {SERVICE_LABELS[svc] ?? svc}
                        </span>

                        {/* Check-in time */}
                        {a.check_in_time && (
                          <span className="text-xs shrink-0 hidden sm:block" style={{ color: '#9CA3AF' }}>
                            {new Date(a.check_in_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Notes tab (placeholder) ── */}
          {tab === 'notes' && (
            <div
              className="rounded-xl py-16 text-center"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}
            >
              <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
              <p className="text-sm font-medium" style={{ color: '#9CA3AF' }}>Notes coming soon</p>
            </div>
          )}

          {/* ── Follow Ups tab (placeholder) ── */}
          {tab === 'followups' && (
            <div
              className="rounded-xl py-16 text-center"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}
            >
              <ChevronRight className="w-10 h-10 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
              <p className="text-sm font-medium" style={{ color: '#9CA3AF' }}>Follow Ups coming soon</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

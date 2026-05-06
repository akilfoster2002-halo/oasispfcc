'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { ArrowLeft, Calendar, Clock, Users, MapPin, CheckCircle2, Circle } from 'lucide-react'

interface EventDetail {
  id: string
  title: string
  date: string
  cells: { id: string; name: string } | null
}

interface AttendeeRow {
  id: string
  name: string
  email: string
  attendanceId?: string
  present: boolean
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [attendees, setAttendees] = useState<AttendeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const loadAttendees = async (cellId: string) => {
    const supabase = getSupabase()
    const [{ data: people }, { data: attendance }] = await Promise.all([
      supabase.from('people').select('id, name, email').eq('cell_id', cellId).order('name'),
      supabase.from('attendance').select('id, person_id, present').eq('meeting_id', id),
    ])
    const attMap = new Map((attendance ?? []).map(a => [a.person_id, a]))
    setAttendees(
      (people ?? []).map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        attendanceId: attMap.get(p.id)?.id,
        present: attMap.get(p.id)?.present ?? false,
      }))
    )
  }

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()
      const { data } = await supabase
        .from('meetings')
        .select('id, title, date, cells(id, name)')
        .eq('id', id)
        .single()
      const ev = data as unknown as EventDetail
      setEvent(ev)
      if (ev?.cells?.id) await loadAttendees(ev.cells.id)
      setLoading(false)
    }
    load()
  }, [id])

  const toggle = async (personId: string, currentPresent: boolean) => {
    if (!event) return
    setSaving(personId)
    const supabase = getSupabase()
    const attendee = attendees.find(a => a.id === personId)!
    const newPresent = !currentPresent

    if (attendee.attendanceId) {
      await supabase
        .from('attendance')
        .update({ present: newPresent })
        .eq('id', attendee.attendanceId)
    } else {
      const { data } = await supabase
        .from('attendance')
        .insert({ meeting_id: id, person_id: personId, present: newPresent })
        .select('id')
        .single()
      setAttendees(prev =>
        prev.map(a => a.id === personId ? { ...a, attendanceId: data?.id, present: newPresent } : a)
      )
      setSaving(null)
      return
    }

    setAttendees(prev => prev.map(a => a.id === personId ? { ...a, present: newPresent } : a))
    setSaving(null)
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 space-y-4">
        {[1, 2].map(i => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: '#E5E7EB' }} />)}
      </div>
    )
  }

  if (!event) {
    return (
      <div className="p-6 md:p-8">
        <Link href="/events" className="inline-flex items-center gap-2 text-sm mb-6 hover:opacity-70"
          style={{ color: '#6B7280' }}>
          <ArrowLeft className="w-4 h-4" /> Back to Events
        </Link>
        <p style={{ color: '#6B7280' }}>Event not found.</p>
      </div>
    )
  }

  const d = new Date(event.date)
  const presentCount = attendees.filter(a => a.present).length
  const totalCount = attendees.length

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <Link href="/events" className="inline-flex items-center gap-2 text-sm mb-6 hover:opacity-70"
        style={{ color: '#6B7280' }}>
        <ArrowLeft className="w-4 h-4" /> Back to Events
      </Link>

      {/* Event header */}
      <div className="bg-white rounded-xl p-6 mb-5" style={{ border: '1px solid #E5E7EB' }}>
        <div className="flex items-start gap-4">
          <div className="w-14 text-center shrink-0 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4068E2' }}>
              {d.toLocaleDateString('en-US', { month: 'short' })}
            </p>
            <p className="text-3xl font-bold leading-tight" style={{ color: '#111827' }}>{d.getDate()}</p>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>
              {d.toLocaleDateString('en-US', { weekday: 'short' })}
            </p>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold" style={{ color: '#111827' }}>{event.title}</h1>
            <div className="flex flex-wrap gap-3 mt-2">
              <span className="flex items-center gap-1.5 text-sm" style={{ color: '#6B7280' }}>
                <Clock className="w-3.5 h-3.5" />
                {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
              {event.cells && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: '#6B7280' }}>
                  <MapPin className="w-3.5 h-3.5" />
                  {event.cells.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attendance section */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: '#6B7280' }} />
            <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Attendance</h2>
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: '#059669' }}>{presentCount}</span>
              <span className="text-sm" style={{ color: '#9CA3AF' }}>/ {totalCount} present</span>
              {totalCount > 0 && (
                <span className="ml-1 text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
                  {Math.round((presentCount / totalCount) * 100)}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Mark all buttons */}
        {totalCount > 0 && (
          <div className="flex gap-2 px-5 py-3" style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#F9FAFB' }}>
            <button
              onClick={async () => {
                for (const a of attendees) if (!a.present) await toggle(a.id, false)
              }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
              style={{ backgroundColor: '#ECFDF5', color: '#059669' }}
            >
              Mark all present
            </button>
            <button
              onClick={async () => {
                for (const a of attendees) if (a.present) await toggle(a.id, true)
              }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
              style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
            >
              Clear all
            </button>
          </div>
        )}

        {!event.cells ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: '#9CA3AF' }}>
              No cell assigned to this event. Assign a cell to track attendance.
            </p>
          </div>
        ) : attendees.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="w-8 h-8 mx-auto mb-2" style={{ color: '#D1D5DB' }} />
            <p className="text-sm" style={{ color: '#9CA3AF' }}>
              No members in {event.cells.name} yet.
            </p>
            <Link href="/people/new" className="mt-2 inline-block text-sm font-medium" style={{ color: '#4068E2' }}>
              Add members →
            </Link>
          </div>
        ) : (
          <ul>
            {attendees.map((person, i) => (
              <li key={person.id}
                className="flex items-center gap-4 px-5 py-3.5"
                style={i < attendees.length - 1 ? { borderBottom: '1px solid #F3F4F6' } : {}}>

                <button
                  onClick={() => toggle(person.id, person.present)}
                  disabled={saving === person.id}
                  className="shrink-0 transition-opacity disabled:opacity-40"
                >
                  {person.present ? (
                    <CheckCircle2 className="w-5 h-5" style={{ color: '#059669' }} />
                  ) : (
                    <Circle className="w-5 h-5" style={{ color: '#D1D5DB' }} />
                  )}
                </button>

                <Link href={`/people/${person.id}`} className="flex-1 min-w-0 hover:opacity-80">
                  <p className="text-sm font-medium truncate" style={{ color: '#111827' }}>{person.name}</p>
                  <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{person.email}</p>
                </Link>

                <span
                  className="text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: person.present ? '#ECFDF5' : '#F9FAFB',
                    color: person.present ? '#059669' : '#9CA3AF',
                    border: `1px solid ${person.present ? '#A7F3D0' : '#E5E7EB'}`,
                  }}
                >
                  {person.present ? 'Present' : 'Absent'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

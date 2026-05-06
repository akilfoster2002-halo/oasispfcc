'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { ArrowLeft, Mail, Edit, Calendar, Layers, MapPin } from 'lucide-react'

interface PersonDetail {
  id: string
  name: string
  email: string
  created_at: string
  cells: {
    id: string
    name: string
    groups: { id: string; name: string; regions: { name: string } | null } | null
  } | null
}

interface AttendanceRecord {
  id: string
  present: boolean
  meetings: { id: string; title: string; date: string } | null
}

type Tab = 'overview' | 'activity' | 'groups'

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function avatarColor(name: string) {
  const colors = ['#4068E2', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0891B2']
  let hash = 0
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [person, setPerson] = useState<PersonDetail | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()
      const [{ data: p }, { data: att }] = await Promise.all([
        supabase
          .from('people')
          .select('id, name, email, created_at, cells(id, name, groups(id, name, regions(name)))')
          .eq('id', id)
          .single(),
        supabase
          .from('attendance')
          .select('id, present, meetings(id, title, date)')
          .eq('person_id', id)
          .order('created_at', { ascending: false }),
      ])
      setPerson(p as unknown as PersonDetail)
      setAttendance((att as unknown as AttendanceRecord[]) ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: '#E5E7EB' }} />
      </div>
    )
  }

  if (!person) {
    return (
      <div className="p-6 md:p-8">
        <Link href="/people" className="flex items-center gap-2 text-sm mb-6" style={{ color: '#6B7280' }}>
          <ArrowLeft className="w-4 h-4" /> Back to People
        </Link>
        <p style={{ color: '#6B7280' }}>Person not found.</p>
      </div>
    )
  }

  const color = avatarColor(person.name)
  const attended = attendance.filter(a => a.present).length
  const total = attendance.length

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'activity', label: `Activity${total > 0 ? ` (${total})` : ''}` },
    { key: 'groups', label: 'Groups' },
  ]

  return (
    <div className="p-6 md:p-8 max-w-3xl">

      {/* Back */}
      <Link href="/people" className="inline-flex items-center gap-2 text-sm mb-6 transition-colors hover:opacity-70"
        style={{ color: '#6B7280' }}>
        <ArrowLeft className="w-4 h-4" /> Back to People
      </Link>

      {/* Profile header */}
      <div className="bg-white rounded-xl p-6 mb-5" style={{ border: '1px solid #E5E7EB' }}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold text-white"
            style={{ backgroundColor: color }}>
            {initials(person.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold" style={{ color: '#111827' }}>{person.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>{person.email}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {person.cells && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: '#EEF2FF', color: '#4068E2' }}>
                  <MapPin className="w-3 h-3" />
                  {person.cells.name}
                </span>
              )}
              {person.cells?.groups && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                  <Layers className="w-3 h-3" />
                  {person.cells.groups.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <a
              href={`mailto:${person.email}`}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#F9FAFB]"
              style={{ border: '1px solid #E5E7EB', color: '#374151' }}
            >
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">Email</span>
            </a>
            <Link
              href={`/people/${person.id}/edit`}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#F9FAFB]"
              style={{ border: '1px solid #E5E7EB', color: '#374151' }}
            >
              <Edit className="w-4 h-4" />
              <span className="hidden sm:inline">Edit</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg w-fit" style={{ backgroundColor: '#F3F4F6' }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={{
              backgroundColor: tab === key ? '#FFFFFF' : 'transparent',
              color: tab === key ? '#111827' : '#6B7280',
              boxShadow: tab === key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #E5E7EB' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#111827' }}>Contact Information</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#9CA3AF' }}>Email</dt>
              <dd className="text-sm" style={{ color: '#111827' }}>{person.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#9CA3AF' }}>Member Since</dt>
              <dd className="text-sm" style={{ color: '#111827' }}>
                {new Date(person.created_at).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#9CA3AF' }}>Cell</dt>
              <dd className="text-sm" style={{ color: '#111827' }}>
                {person.cells ? (
                  <Link href={`/groups`} className="hover:underline" style={{ color: '#4068E2' }}>
                    {person.cells.name}
                  </Link>
                ) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#9CA3AF' }}>Group</dt>
              <dd className="text-sm" style={{ color: '#111827' }}>
                {person.cells?.groups?.name ?? '—'}
              </dd>
            </div>
            {person.cells?.groups?.regions && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#9CA3AF' }}>Region</dt>
                <dd className="text-sm" style={{ color: '#111827' }}>{person.cells.groups.regions.name}</dd>
              </div>
            )}
            {total > 0 && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#9CA3AF' }}>Attendance Rate</dt>
                <dd className="text-sm font-medium" style={{ color: '#059669' }}>
                  {Math.round((attended / total) * 100)}% ({attended}/{total} events)
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {tab === 'activity' && (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Attendance History</h2>
          </div>
          {attendance.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="w-8 h-8 mx-auto mb-2" style={{ color: '#D1D5DB' }} />
              <p className="text-sm" style={{ color: '#9CA3AF' }}>No attendance records yet.</p>
            </div>
          ) : (
            <ul>
              {attendance.map((record, i) => {
                const d = record.meetings ? new Date(record.meetings.date) : null
                return (
                  <li key={record.id}
                    className="flex items-center gap-4 px-5 py-3.5"
                    style={i < attendance.length - 1 ? { borderBottom: '1px solid #F3F4F6' } : {}}>
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: record.present ? '#059669' : '#D1D5DB' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#111827' }}>
                        {record.meetings?.title ?? 'Unknown event'}
                      </p>
                      {d && (
                        <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                          {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <span
                      className="text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: record.present ? '#ECFDF5' : '#F9FAFB',
                        color: record.present ? '#059669' : '#9CA3AF',
                      }}
                    >
                      {record.present ? 'Present' : 'Absent'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {tab === 'groups' && (
        <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #E5E7EB' }}>
          {person.cells ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: '#EEF2FF' }}>
                  <MapPin className="w-4 h-4" style={{ color: '#4068E2' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#111827' }}>{person.cells.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Cell group</p>
                </div>
              </div>
              {person.cells.groups && (
                <div className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: '#FFFBEB' }}>
                    <Layers className="w-4 h-4" style={{ color: '#D97706' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#111827' }}>{person.cells.groups.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                      Group{person.cells.groups.regions ? ` · ${person.cells.groups.regions.name} region` : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-center py-8" style={{ color: '#9CA3AF' }}>
              Not assigned to a cell yet.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

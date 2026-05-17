'use client'

import { useEffect, useState } from 'react'
import { Search, Users } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useUserProfile } from '@/lib/use-user-profile'

interface AttendeeRow {
  id: string
  name: string
  phone: string | null
  created_at: string
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const PALETTE = ['#6366f1', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2']
function avatarColor(name: string) {
  let h = 0
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return PALETTE[Math.abs(h) % PALETTE.length]
}

export default function PeoplePage() {
  const { profile, loading: profileLoading } = useUserProfile()
  const [people, setPeople]   = useState<AttendeeRow[]>([])
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profileLoading) return

    const sb = getSupabaseBrowser()

    async function load() {
      let ids: string[] | null = null

      // Group users: get attendee IDs for their group only
      if (profile?.role === 'group' && profile.group_id) {
        const { data: rows } = await sb
          .from('attendance')
          .select('attendee_id, meetings!inner(group_id)')
          .eq('meetings.group_id', profile.group_id)
        ids = [...new Set((rows ?? []).map((r: { attendee_id: string }) => r.attendee_id))]
        if (ids.length === 0) { setLoading(false); return }
      }

      let q = sb
        .from('attendees')
        .select('id, name, phone, created_at')
        .order('name')

      if (ids !== null) q = q.in('id', ids)

      const { data } = await q
      setPeople((data as AttendeeRow[]) ?? [])
      setLoading(false)
    }

    load()
  }, [profile, profileLoading])

  const filtered = people.filter(p => {
    const q = query.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.phone ?? '').includes(q)
  })

  const groupLabel = profile?.role === 'group' ? null : null

  return (
    <div
      className="min-h-screen px-6 py-8"
      style={{
        background: 'linear-gradient(180deg, rgba(10,14,35,0.95) 0%, rgba(8,12,26,0.98) 100%)',
      }}
    >
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(129,140,248,0.15) 100%)',
              border: '1px solid rgba(129,140,248,0.25)',
            }}
          >
            <Users className="w-5 h-5" style={{ color: '#818cf8' }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>
              People
            </h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>
              {loading ? '—' : `${people.length.toLocaleString()} member${people.length !== 1 ? 's' : ''}${profile?.role === 'group' ? ' in your group' : ''}`}
            </p>
          </div>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 mb-5 px-4 py-2.5 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.09)',
            maxWidth: 360,
          }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or phone…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'rgba(255,255,255,0.80)' }}
          />
        </div>

        {/* Table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,12,26,0.55)' }}
        >
          {/* Column headers */}
          <div
            className="grid grid-cols-[2fr_1.5fr_1fr] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wide"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.30)' }}
          >
            <span>Name</span>
            <span className="hidden sm:block">Phone</span>
            <span className="hidden md:block">Since</span>
          </div>

          {loading || profileLoading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-12 rounded-xl animate-pulse"
                  style={{ background: 'rgba(255,255,255,0.05)' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.30)' }}>
                {query ? `No results for "${query}"` : 'No members yet.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              {filtered.map(person => {
                const color = avatarColor(person.name)
                return (
                  <li key={person.id}>
                    <div className="grid grid-cols-[2fr_1.5fr_1fr] gap-4 items-center px-5 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white"
                          style={{ background: color }}
                        >
                          {initials(person.name)}
                        </div>
                        <span className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                          {person.name}
                        </span>
                      </div>

                      <span className="hidden sm:block text-sm truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {person.phone ?? <span style={{ color: 'rgba(255,255,255,0.18)' }}>—</span>}
                      </span>

                      <span className="hidden md:block text-sm" style={{ color: 'rgba(255,255,255,0.30)' }}>
                        {new Date(person.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <p className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>
            Showing {filtered.length.toLocaleString()} of {people.length.toLocaleString()} members
          </p>
        )}
      </div>
    </div>
  )
}

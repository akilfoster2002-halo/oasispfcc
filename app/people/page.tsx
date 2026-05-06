'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { Search, UserPlus, ChevronRight } from 'lucide-react'

interface PersonRow {
  id: string
  name: string
  email: string
  created_at: string
  cells: { name: string; groups: { name: string } | null } | null
}

function initials(name: string) {
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function avatarColor(name: string) {
  const colors = ['#4068E2', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0891B2']
  let hash = 0
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function PeoplePage() {
  const [people, setPeople] = useState<PersonRow[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()
      const { data } = await supabase
        .from('people')
        .select('id, name, email, created_at, cells(name, groups(name))')
        .order('name')
      setPeople((data as unknown as PersonRow[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = people.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.email.toLowerCase().includes(query.toLowerCase()) ||
    (p.cells?.name ?? '').toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="p-6 md:p-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#111827' }}>People</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            {loading ? '—' : `${people.length} member${people.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          href="/people/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: '#4068E2' }}
        >
          <UserPlus className="w-4 h-4" />
          Add Person
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
        <input
          type="text"
          placeholder="Search by name, email, or cell…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-white outline-none focus:ring-2"
          style={{ border: '1px solid #E5E7EB', color: '#111827' }}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>

        {/* Table header */}
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wide"
          style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#6B7280' }}>
          <span>Name</span>
          <span className="hidden sm:block">Email</span>
          <span className="hidden md:block">Cell</span>
          <span className="hidden lg:block">Joined</span>
          <span />
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 rounded animate-pulse" style={{ backgroundColor: '#F3F4F6' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: '#9CA3AF' }}>
              {query ? `No results for "${query}"` : 'No people yet. Add your first member.'}
            </p>
            {!query && (
              <Link href="/people/new" className="mt-2 inline-block text-sm font-medium" style={{ color: '#4068E2' }}>
                Add person →
              </Link>
            )}
          </div>
        ) : (
          <ul>
            {filtered.map((person, i) => {
              const color = avatarColor(person.name)
              return (
                <li key={person.id}>
                  <Link
                    href={`/people/${person.id}`}
                    className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 items-center px-5 py-3.5 hover:bg-[#F9FAFB] transition-colors"
                    style={i < filtered.length - 1 ? { borderBottom: '1px solid #F3F4F6' } : {}}
                  >
                    {/* Name + avatar */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white"
                        style={{ backgroundColor: color }}>
                        {initials(person.name)}
                      </div>
                      <span className="text-sm font-medium truncate" style={{ color: '#111827' }}>
                        {person.name}
                      </span>
                    </div>

                    {/* Email */}
                    <span className="hidden sm:block text-sm truncate" style={{ color: '#6B7280' }}>
                      {person.email}
                    </span>

                    {/* Cell */}
                    <span className="hidden md:block text-sm truncate" style={{ color: '#6B7280' }}>
                      {person.cells?.name ?? (
                        <span style={{ color: '#D1D5DB' }}>—</span>
                      )}
                    </span>

                    {/* Joined */}
                    <span className="hidden lg:block text-sm" style={{ color: '#9CA3AF' }}>
                      {new Date(person.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>

                    <ChevronRight className="w-4 h-4" style={{ color: '#D1D5DB' }} />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="mt-3 text-xs" style={{ color: '#9CA3AF' }}>
          Showing {filtered.length} of {people.length} people
        </p>
      )}
    </div>
  )
}

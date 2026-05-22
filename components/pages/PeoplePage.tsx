'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Users, Archive, RotateCcw, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useUserProfile } from '@/lib/use-user-profile'

interface PersonRow {
  id: string
  first_name: string
  last_name: string
  name: string
  phone: string | null
  created_at: string
  designation: string | null
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const PALETTE = ['#A88A35', '#059669', '#d97706', '#4F7FC4', '#db2777', '#0891b2']
function avatarColor(name: string) {
  let h = 0
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return PALETTE[Math.abs(h) % PALETTE.length]
}

export default function PeoplePage() {
  const params = useParams()
  const slug = params?.slug as string
  const { profile, loading: profileLoading } = useUserProfile()

  const [people, setPeople]   = useState<PersonRow[]>([])
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'active' | 'archived'>('active')
  const [acting, setActing]   = useState<string | null>(null)   // id being restored/deleted

  useEffect(() => {
    if (profileLoading) return
    const sb = getSupabaseBrowser()

    async function load() {
      let ids: string[] | null = null

      if (profile?.role === 'group' && profile.group_id) {
        const { data: rows } = await sb
          .from('attendance')
          .select('person_id, events!inner(group_id)')
          .eq('events.group_id', profile.group_id)
        ids = [...new Set((rows ?? []).map((r: { person_id: string }) => r.person_id))]
        if (ids.length === 0) { setLoading(false); return }
      }

      let q = sb
        .from('people')
        .select('id, first_name, last_name, phone, created_at, designation')
        .order('last_name')

      if (ids !== null) q = q.in('id', ids)

      const { data } = await q
      setPeople(
        ((data ?? []) as Omit<PersonRow, 'name'>[])
          .map(p => ({ ...p, name: `${p.first_name} ${p.last_name}`.trim() }))
      )
      setLoading(false)
    }

    load()
  }, [profile, profileLoading])

  const active   = people.filter(p => p.designation !== 'archived')
  const archived = people.filter(p => p.designation === 'archived')
  const list     = tab === 'active' ? active : archived

  const filtered = list.filter(p => {
    const q = query.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.phone ?? '').includes(q)
  })

  const handleRestore = useCallback(async (id: string) => {
    setActing(id)
    const sb = getSupabaseBrowser()
    await sb.from('people').update({ designation: null }).eq('id', id)
    setPeople(prev => prev.map(p => p.id === id ? { ...p, designation: null } : p))
    setActing(null)
  }, [])

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!confirm(`Permanently delete ${name}? This cannot be undone and will remove all their attendance records.`)) return
    setActing(id)
    const sb = getSupabaseBrowser()
    await sb.from('people').delete().eq('id', id)
    setPeople(prev => prev.filter(p => p.id !== id))
    setActing(null)
  }, [])

  // Tab pill style
  const tabPill = (active: boolean) => ({
    background: active
      ? 'linear-gradient(135deg, rgba(201,168,76,0.22) 0%, rgba(201,168,76,0.15) 100%)'
      : 'transparent',
    border: active ? '1px solid rgba(201,168,76,0.28)' : '1px solid transparent',
    color: active ? '#C9A84C' : 'rgba(255,255,255,0.40)',
    borderRadius: '10px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: active ? '600' : '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  } as React.CSSProperties)

  return (
    <div
      className="min-h-screen px-6 py-8"
      style={{ background: 'linear-gradient(180deg, rgba(10,14,35,0.95) 0%, rgba(8,12,26,0.98) 100%)' }}
    >
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(201,168,76,0.25) 0%, rgba(201,168,76,0.15) 100%)',
              border: '1px solid rgba(201,168,76,0.25)',
            }}
          >
            <Users className="w-5 h-5" style={{ color: '#C9A84C' }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>People</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>
              {loading ? '—' : `${active.length.toLocaleString()} active member${active.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Tabs + Search row */}
        <div className="flex flex-wrap items-center gap-3 mb-5">

          {/* Active / Archived tabs */}
          <div
            className="flex gap-0.5 p-1 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <button onClick={() => { setTab('active'); setQuery('') }} style={tabPill(tab === 'active')}>
              <Users className="w-3.5 h-3.5" />
              Active
              {!loading && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: tab === 'active' ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.08)',
                    color: tab === 'active' ? '#C9A84C' : 'rgba(255,255,255,0.35)',
                  }}
                >
                  {active.length}
                </span>
              )}
            </button>
            <button onClick={() => { setTab('archived'); setQuery('') }} style={tabPill(tab === 'archived')}>
              <Archive className="w-3.5 h-3.5" />
              Archived
              {!loading && archived.length > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: tab === 'archived' ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.08)',
                    color: tab === 'archived' ? '#C9A84C' : 'rgba(255,255,255,0.35)',
                  }}
                >
                  {archived.length}
                </span>
              )}
            </button>
          </div>

          {/* Search */}
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl flex-1"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.09)',
              maxWidth: 320,
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
        </div>

        {/* Table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,12,26,0.55)' }}
        >
          {/* Column headers */}
          <div
            className="px-5 py-3 text-xs font-semibold uppercase tracking-wide"
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.30)',
              display: 'grid',
              gridTemplateColumns: tab === 'archived' ? '2fr 1.5fr auto' : '2fr 1.5fr 1fr',
              gap: '1rem',
            }}
          >
            <span>Name</span>
            <span className="hidden sm:block">Phone</span>
            <span className="hidden md:block">{tab === 'archived' ? 'Actions' : 'Since'}</span>
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
              {tab === 'archived' ? (
                <>
                  <Archive className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.12)' }} />
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.30)' }}>
                    {query ? `No archived members matching "${query}"` : 'No archived members'}
                  </p>
                </>
              ) : (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.30)' }}>
                  {query ? `No results for "${query}"` : 'No members yet.'}
                </p>
              )}
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              {filtered.map(person => {
                const color = avatarColor(person.name)
                const isActing = acting === person.id

                if (tab === 'archived') {
                  return (
                    <li key={person.id}>
                      <div
                        className="flex items-center gap-4 px-5 py-3.5"
                        style={{ opacity: isActing ? 0.5 : 1, transition: 'opacity 0.2s' }}
                      >
                        {/* Avatar + Name */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white"
                            style={{ background: color, opacity: 0.6 }}
                          >
                            {initials(person.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>
                              {person.name}
                            </p>
                            {person.phone && (
                              <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.25)' }}>
                                {person.phone}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleRestore(person.id)}
                            disabled={isActing}
                            title="Restore to active"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                            style={{
                              backgroundColor: 'rgba(5,150,105,0.12)',
                              border: '1px solid rgba(5,150,105,0.25)',
                              color: '#34d399',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(5,150,105,0.22)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(5,150,105,0.12)')}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Restore
                          </button>
                          <button
                            onClick={() => handleDelete(person.id, person.name)}
                            disabled={isActing}
                            title="Permanently delete"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                            style={{
                              backgroundColor: 'rgba(248,113,113,0.10)',
                              border: '1px solid rgba(248,113,113,0.22)',
                              color: '#f87171',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.20)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.10)')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                }

                // Active row — clickable link
                return (
                  <li key={person.id}>
                    <Link
                      href={`/${slug}/people/${person.id}`}
                      className="grid gap-4 items-center px-5 py-3.5 transition-colors"
                      style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
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
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <p className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>
            Showing {filtered.length.toLocaleString()} of {list.length.toLocaleString()} {tab === 'archived' ? 'archived' : 'active'} members
          </p>
        )}

        {/* Archived info callout */}
        {tab === 'archived' && !loading && archived.length > 0 && (
          <div
            className="mt-4 px-4 py-3 rounded-xl text-xs"
            style={{
              background: 'rgba(248,113,113,0.07)',
              border: '1px solid rgba(248,113,113,0.15)',
              color: 'rgba(255,255,255,0.40)',
            }}
          >
            Deleting a person is permanent and removes all their attendance records. Use Restore to move them back to active.
          </div>
        )}
      </div>
    </div>
  )
}

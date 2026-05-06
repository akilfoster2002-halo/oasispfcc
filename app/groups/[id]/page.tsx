'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { ArrowLeft, Layers, MapPin, Users, ChevronRight } from 'lucide-react'

interface GroupDetail {
  id: string
  name: string
  created_at: string
  regions: { name: string; description?: string } | null
}

interface CellWithPeople {
  id: string
  name: string
  people: { id: string; name: string; email: string }[]
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function avatarColor(name: string) {
  const colors = ['#4068E2', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0891B2']
  let hash = 0
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [cells, setCells] = useState<CellWithPeople[]>([])
  const [expandedCell, setExpandedCell] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()
      const [{ data: g }, { data: c }] = await Promise.all([
        supabase
          .from('groups')
          .select('id, name, created_at, regions(name, description)')
          .eq('id', id)
          .single(),
        supabase
          .from('cells')
          .select('id, name, people(id, name, email)')
          .eq('group_id', id)
          .order('name'),
      ])
      setGroup(g as unknown as GroupDetail)
      setCells((c as unknown as CellWithPeople[]) ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  const totalPeople = cells.reduce((sum, c) => sum + c.people.length, 0)

  if (loading) {
    return (
      <div className="p-6 md:p-8 space-y-3">
        {[1, 2].map(i => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: '#E5E7EB' }} />)}
      </div>
    )
  }

  if (!group) {
    return (
      <div className="p-6 md:p-8">
        <Link href="/groups" className="inline-flex items-center gap-2 text-sm mb-6 hover:opacity-70"
          style={{ color: '#6B7280' }}>
          <ArrowLeft className="w-4 h-4" /> Back to Groups
        </Link>
        <p style={{ color: '#6B7280' }}>Group not found.</p>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <Link href="/groups" className="inline-flex items-center gap-2 text-sm mb-6 hover:opacity-70"
        style={{ color: '#6B7280' }}>
        <ArrowLeft className="w-4 h-4" /> Back to Groups
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl p-6 mb-5" style={{ border: '1px solid #E5E7EB' }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#FFFBEB' }}>
            <Layers className="w-6 h-6" style={{ color: '#D97706' }} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold" style={{ color: '#111827' }}>{group.name}</h1>
            {group.regions && (
              <p className="flex items-center gap-1.5 mt-1 text-sm" style={{ color: '#6B7280' }}>
                <MapPin className="w-3.5 h-3.5" />
                {group.regions.name} Region
              </p>
            )}
            <div className="flex gap-5 mt-4">
              <div>
                <p className="text-2xl font-semibold tabular-nums" style={{ color: '#111827' }}>{cells.length}</p>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>Cells</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums" style={{ color: '#111827' }}>{totalPeople}</p>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>People</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cells list */}
      <h2 className="text-sm font-semibold mb-3" style={{ color: '#6B7280' }}>
        CELLS ({cells.length})
      </h2>

      {cells.length === 0 ? (
        <div className="bg-white rounded-xl py-12 text-center" style={{ border: '1px solid #E5E7EB' }}>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>No cells in this group yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cells.map(cell => (
            <div key={cell.id} className="bg-white rounded-xl overflow-hidden"
              style={{ border: '1px solid #E5E7EB' }}>
              <button
                onClick={() => setExpandedCell(expandedCell === cell.id ? null : cell.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: '#EEF2FF' }}>
                  <Users className="w-4 h-4" style={{ color: '#4068E2' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: '#111827' }}>{cell.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                    {cell.people.length} {cell.people.length === 1 ? 'person' : 'people'}
                  </p>
                </div>
                <ChevronRight
                  className="w-4 h-4 shrink-0 transition-transform"
                  style={{
                    color: '#D1D5DB',
                    transform: expandedCell === cell.id ? 'rotate(90deg)' : 'none',
                  }}
                />
              </button>

              {expandedCell === cell.id && cell.people.length > 0 && (
                <ul style={{ borderTop: '1px solid #F3F4F6' }}>
                  {cell.people.map((person, i) => (
                    <li key={person.id}
                      style={i < cell.people.length - 1 ? { borderBottom: '1px solid #F3F4F6' } : {}}>
                      <Link
                        href={`/people/${person.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-[#F9FAFB] transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white"
                          style={{ backgroundColor: avatarColor(person.name) }}>
                          {initials(person.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: '#111827' }}>{person.name}</p>
                          <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{person.email}</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: '#D1D5DB' }} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {expandedCell === cell.id && cell.people.length === 0 && (
                <p className="px-5 py-4 text-sm" style={{ color: '#9CA3AF', borderTop: '1px solid #F3F4F6' }}>
                  No members in this cell.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

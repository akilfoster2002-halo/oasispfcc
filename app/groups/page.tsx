'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { Layers, Users, MapPin, ChevronRight, Plus } from 'lucide-react'

interface GroupRow {
  id: string
  name: string
  created_at: string
  regions: { name: string } | null
  cells: { id: string; name: string; people: { id: string }[] }[]
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await getSupabase()
        .from('groups')
        .select('id, name, created_at, regions(name), cells(id, name, people(id))')
        .order('name')
      setGroups((data as unknown as GroupRow[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const totalPeople = (group: GroupRow) =>
    group.cells.reduce((sum, c) => sum + c.people.length, 0)

  return (
    <div className="p-6 md:p-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#111827' }}>Groups</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            {loading ? '—' : `${groups.length} group${groups.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          href="/groups/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#4068E2' }}
        >
          <Plus className="w-4 h-4" />
          New Group
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: '#E5E7EB' }} />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-xl py-16 text-center" style={{ border: '1px solid #E5E7EB' }}>
          <Layers className="w-10 h-10 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
          <p className="text-sm font-medium" style={{ color: '#6B7280' }}>No groups yet</p>
          <Link href="/groups/new" className="mt-2 inline-block text-sm font-medium" style={{ color: '#4068E2' }}>
            Create your first group →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="flex items-center gap-5 bg-white rounded-xl px-5 py-4 hover:shadow-sm transition-shadow"
              style={{ border: '1px solid #E5E7EB' }}
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: '#FFFBEB' }}>
                <Layers className="w-5 h-5" style={{ color: '#D97706' }} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#111827' }}>{group.name}</p>
                {group.regions && (
                  <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#9CA3AF' }}>
                    <MapPin className="w-3 h-3" />
                    {group.regions.name}
                  </p>
                )}
              </div>

              {/* Stats */}
              <div className="flex gap-5 shrink-0">
                <div className="hidden sm:flex flex-col items-center">
                  <span className="text-lg font-semibold tabular-nums" style={{ color: '#111827' }}>
                    {group.cells.length}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Cells</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-lg font-semibold tabular-nums" style={{ color: '#111827' }}>
                    {totalPeople(group)}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide" style={{ color: '#9CA3AF' }}>People</span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: '#D1D5DB' }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

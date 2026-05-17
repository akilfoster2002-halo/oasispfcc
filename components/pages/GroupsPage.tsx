'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { Layers, MapPin, ChevronRight, Plus } from 'lucide-react'

interface GroupRow {
  id: string
  name: string
  created_at: string
}

export default function GroupsPage() {
  const params = useParams()
  const slug = (params?.slug as string) ?? 'pfcc-longisland'
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = getSupabaseBrowser()
    const load = async () => {
      const { data } = await sb
        .from('groups')
        .select('id, name, created_at')
        .order('name')
      setGroups((data as GroupRow[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#111827' }}>Groups</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            {loading ? '—' : `${groups.length} group${groups.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          href={`/${slug}/groups/new`}
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
          <Link href={`/${slug}/groups/new`} className="mt-2 inline-block text-sm font-medium" style={{ color: '#4068E2' }}>
            Create your first group →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <Link
              key={group.id}
              href={`/${slug}/groups/${group.id}`}
              className="flex items-center gap-5 bg-white rounded-xl px-5 py-4 hover:shadow-sm transition-shadow"
              style={{ border: '1px solid #E5E7EB' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: '#FFFBEB' }}>
                <Layers className="w-5 h-5" style={{ color: '#D97706' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#111827' }}>{group.name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                  {new Date(group.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: '#D1D5DB' }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

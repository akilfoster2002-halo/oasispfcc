'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { Layers, Plus, ChevronRight } from 'lucide-react'

interface GroupRow {
  id: string
  name: string
  created_at: string
}

const GROUP_PALETTE = [
  '#818cf8', '#34d399', '#fbbf24', '#22d3ee',
  '#a78bfa', '#f472b6', '#60a5fa', '#f87171',
]
function groupColor(name: string): string {
  let h = 0
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return GROUP_PALETTE[Math.abs(h) % GROUP_PALETTE.length]
}

export default function GroupsPage() {
  const params = useParams()
  const slug = params?.slug as string
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSupabaseBrowser()
      .from('groups')
      .select('id, name, created_at')
      .order('name')
      .then(({ data }) => {
        setGroups((data as GroupRow[]) ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen px-6 py-8" style={{ maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(245,158,11,0.10) 100%)',
              border: '1px solid rgba(251,191,36,0.22)',
            }}
          >
            <Layers className="w-5 h-5" style={{ color: '#fbbf24' }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em' }}>
              Groups
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.36)', marginTop: 1 }}>
              {loading ? '—' : `${groups.length} group${groups.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <Link
          href={`/${slug}/groups/new`}
          className="flex items-center gap-2 rounded-xl text-sm font-medium text-white transition-all"
          style={{
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
            boxShadow: '0 4px 14px rgba(99,102,241,0.28)',
            letterSpacing: '-0.01em',
          }}
        >
          <Plus className="w-4 h-4" />
          New Group
        </Link>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-[68px] rounded-2xl shimmer"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div
          className="rounded-2xl py-20 text-center"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px dashed rgba(255,255,255,0.08)',
          }}
        >
          <Layers className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.12)' }} />
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.38)', fontWeight: 500 }}>No groups yet</p>
          <Link
            href={`/${slug}/groups/new`}
            style={{ fontSize: 13, color: '#818cf8', marginTop: 6, display: 'inline-block' }}
          >
            Create your first group →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map(group => {
            const color = groupColor(group.name)
            return (
              <Link
                key={group.id}
                href={`/${slug}/groups/${group.id}`}
                className="flex items-center gap-4 rounded-2xl px-5 transition-all duration-150"
                style={{
                  height: 68,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.018) 100%)',
                  border: '1px solid rgba(255,255,255,0.065)',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.065) 0%, rgba(255,255,255,0.030) 100%)'
                  el.style.borderColor = 'rgba(255,255,255,0.10)'
                  el.style.transform = 'translateY(-1px)'
                  el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.30)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.018) 100%)'
                  el.style.borderColor = 'rgba(255,255,255,0.065)'
                  el.style.transform = 'none'
                  el.style.boxShadow = 'none'
                }}
              >
                {/* Color mark */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: `${color}16`,
                    border: `1px solid ${color}30`,
                  }}
                >
                  <Layers className="w-4 h-4" style={{ color }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.88)',
                    letterSpacing: '-0.01em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {group.name}
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', marginTop: 2 }}>
                    Created {new Date(group.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                </div>

                <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.18)' }} />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

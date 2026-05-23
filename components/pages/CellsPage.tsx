'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { Users, Plus, ChevronRight, MapPin, Clock } from 'lucide-react'

interface Cell {
  id: string
  name: string
  group_id: string | null
  group_name: string | null
  leader_name: string | null
  meeting_day: number | null
  meeting_time: string | null
  location: string | null
  color: string
  is_active: boolean
  created_at: string
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function fmt24(t: string | null): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h24 = parseInt(hStr ?? '0')
  const m   = mStr ?? '00'
  const ap  = h24 >= 12 ? 'pm' : 'am'
  const h12 = h24 % 12 || 12
  return m === '00' ? `${h12}${ap}` : `${h12}:${m}${ap}`
}

export default function CellsPage() {
  const params = useParams()
  const slug = params?.slug as string

  const [cells, setCells]   = useState<Cell[]>([])
  const [churchId, setChurchId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSupabaseBrowser()
      .from('churches').select('id').eq('slug', slug).single()
      .then(({ data }) => data && setChurchId(data.id))
  }, [slug])

  useEffect(() => {
    if (!churchId) return
    fetch(`/api/cells?churchId=${churchId}`)
      .then(r => r.json())
      .then(d => { setCells(d.cells ?? []); setLoading(false) })
  }, [churchId])

  return (
    <div className="min-h-screen px-6 py-8" style={{ maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(201,168,76,0.18) 0%, rgba(201,168,76,0.10) 100%)',
              border: '1px solid rgba(201,168,76,0.22)',
            }}
          >
            <Users className="w-5 h-5" style={{ color: '#C9A84C' }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em' }}>
              Cells
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.36)', marginTop: 1 }}>
              {loading ? '—' : `${cells.length} cell${cells.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <Link
          href={`/${slug}/cells/new`}
          className="flex items-center gap-2 rounded-xl text-sm font-medium text-white"
          style={{
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #A88A35 0%, #A88A35 100%)',
            boxShadow: '0 4px 14px rgba(201,168,76,0.28)',
            letterSpacing: '-0.01em',
            textDecoration: 'none',
          }}
        >
          <Plus className="w-4 h-4" />
          New Cell
        </Link>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-[68px] rounded-2xl shimmer" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : cells.length === 0 ? (
        <div
          className="rounded-2xl py-20 text-center"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px dashed rgba(255,255,255,0.08)' }}
        >
          <Users className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.12)' }} />
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.38)', fontWeight: 500 }}>No cells yet</p>
          <Link
            href={`/${slug}/cells/new`}
            style={{ fontSize: 13, color: '#C9A84C', marginTop: 6, display: 'inline-block', textDecoration: 'none' }}
          >
            Create your first cell →
          </Link>
        </div>
      ) : (() => {
        // Group cells by group_name, ungrouped last
        const groupMap = new Map<string, Cell[]>()
        for (const cell of cells) {
          const key = cell.group_name ?? '__none__'
          if (!groupMap.has(key)) groupMap.set(key, [])
          groupMap.get(key)!.push(cell)
        }
        // Sort: named groups alphabetically, then ungrouped
        const sortedGroups = [...groupMap.keys()].sort((a, b) => {
          if (a === '__none__') return 1
          if (b === '__none__') return -1
          return a.localeCompare(b)
        })

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {sortedGroups.map(groupKey => {
              const groupCells = groupMap.get(groupKey)!
              const groupLabel = groupKey === '__none__' ? null : groupKey
              return (
                <div key={groupKey}>
                  {groupLabel && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', margin: 0 }}>
                        {groupLabel}
                      </p>
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.20)' }}>{groupCells.length}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {groupCells.map(cell => (
                      <Link
                        key={cell.id}
                        href={`/${slug}/cells/${cell.id}`}
                        className="flex items-center gap-4 rounded-2xl px-5 transition-all duration-150"
                        style={{
                          height: 72,
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.018) 100%)',
                          border: '1px solid rgba(255,255,255,0.065)',
                          textDecoration: 'none',
                          display: 'flex',
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
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${cell.color}18`, border: `1px solid ${cell.color}35` }}
                        >
                          <Users className="w-4 h-4" style={{ color: cell.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                            {cell.name}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
                            {cell.leader_name && (
                              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.36)' }}>{cell.leader_name}</span>
                            )}
                            {cell.meeting_day !== null && (
                              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Clock style={{ width: 10, height: 10 }} />
                                Every {DAY_NAMES[cell.meeting_day]}{cell.meeting_time ? ` · ${fmt24(cell.meeting_time)}` : ''}
                              </span>
                            )}
                            {cell.location && (
                              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.24)', display: 'flex', alignItems: 'center', gap: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <MapPin style={{ width: 10, height: 10, flexShrink: 0 }} />
                                {cell.location}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.18)' }} />
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}

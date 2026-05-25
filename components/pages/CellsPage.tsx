'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { Users, Plus, ChevronRight, ChevronDown, MapPin, Clock, Layers } from 'lucide-react'

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

  const [cells,    setCells]    = useState<Cell[]>([])
  const [churchId, setChurchId] = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    getSupabaseBrowser()
      .from('churches').select('id').eq('slug', slug).single()
      .then(({ data }) => data && setChurchId(data.id))
  }, [slug])

  useEffect(() => {
    if (!churchId) return
    fetch(`/api/cells?churchId=${churchId}`)
      .then(r => r.json())
      .then(d => {
        const loaded: Cell[] = d.cells ?? []
        setCells(loaded)
        // Default: expand all groups
        const keys = [...new Set(loaded.map(c => c.group_name ?? '__none__'))]
        setExpanded(new Set(keys))
        setLoading(false)
      })
  }, [churchId])

  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Build group map
  const groupMap = new Map<string, Cell[]>()
  for (const cell of cells) {
    const key = cell.group_name ?? '__none__'
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(cell)
  }
  const sortedGroups = [...groupMap.keys()].sort((a, b) => {
    if (a === '__none__') return 1
    if (b === '__none__') return -1
    return a.localeCompare(b)
  })

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(201,168,76,0.18) 0%, rgba(201,168,76,0.10) 100%)',
            border: '1px solid rgba(201,168,76,0.22)',
          }}>
            <Users style={{ width: 18, height: 18, color: '#C9A84C' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em', margin: 0 }}>Cells</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.36)', margin: '2px 0 0' }}>
              {loading ? '—' : `${sortedGroups.length} group${sortedGroups.length !== 1 ? 's' : ''} · ${cells.length} cells`}
            </p>
          </div>
        </div>
        <Link
          href={`/${slug}/cells/new`}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 12,
            background: 'linear-gradient(135deg, #A88A35 0%, #C9A84C 100%)',
            boxShadow: '0 4px 14px rgba(201,168,76,0.28)',
            fontSize: 13, fontWeight: 500, color: '#fff',
            textDecoration: 'none', letterSpacing: '-0.01em',
          }}
        >
          <Plus style={{ width: 15, height: 15 }} />
          New Cell
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2].map(i => (
            <div key={i} style={{ height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.04)' }} className="shimmer" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && cells.length === 0 && (
        <div style={{ borderRadius: 20, padding: '80px 0', textAlign: 'center', background: 'rgba(255,255,255,0.025)', border: '1px dashed rgba(255,255,255,0.08)' }}>
          <Users style={{ width: 40, height: 40, color: 'rgba(255,255,255,0.12)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.38)', fontWeight: 500, margin: 0 }}>No cells yet</p>
          <Link href={`/${slug}/cells/new`} style={{ fontSize: 13, color: '#C9A84C', marginTop: 8, display: 'inline-block', textDecoration: 'none' }}>
            Create your first cell →
          </Link>
        </div>
      )}

      {/* Groups */}
      {!loading && cells.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sortedGroups.map(groupKey => {
            const groupCells = groupMap.get(groupKey)!
            const label      = groupKey === '__none__' ? 'Ungrouped' : groupKey
            const isOpen     = expanded.has(groupKey)

            return (
              <div key={groupKey} style={{
                borderRadius: 18,
                border: '1px solid rgba(255,255,255,0.07)',
                background: 'linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
                overflow: 'hidden',
              }}>
                {/* Group header — clickable */}
                <button
                  onClick={() => toggle(groupKey)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.22)',
                  }}>
                    <Layers style={{ width: 15, height: 15, color: '#C9A84C' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)', margin: 0, letterSpacing: '-0.01em' }}>
                      {label}
                    </p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', margin: '2px 0 0' }}>
                      {groupCells.length} cell{groupCells.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronDown style={{
                    width: 16, height: 16, color: 'rgba(255,255,255,0.28)', flexShrink: 0,
                    transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 200ms ease',
                  }} />
                </button>

                {/* Cell list */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 12px 12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {groupCells.map(cell => (
                        <Link
                          key={cell.id}
                          href={`/${slug}/cells/${cell.id}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 12px', borderRadius: 12,
                            background: 'transparent',
                            border: '1px solid transparent',
                            textDecoration: 'none',
                            transition: 'background 150ms ease, border-color 150ms ease',
                          }}
                          onMouseEnter={e => {
                            const el = e.currentTarget as HTMLElement
                            el.style.background = 'rgba(255,255,255,0.05)'
                            el.style.borderColor = 'rgba(255,255,255,0.08)'
                          }}
                          onMouseLeave={e => {
                            const el = e.currentTarget as HTMLElement
                            el.style.background = 'transparent'
                            el.style.borderColor = 'transparent'
                          }}
                        >
                          {/* Color dot */}
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                            background: cell.color, boxShadow: `0 0 6px ${cell.color}66`,
                          }} />

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)', margin: 0, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {cell.name}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                              {cell.leader_name && (
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.34)' }}>{cell.leader_name}</span>
                              )}
                              {cell.meeting_day !== null && (
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.26)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Clock style={{ width: 9, height: 9 }} />
                                  Every {DAY_NAMES[cell.meeting_day]}{cell.meeting_time ? ` · ${fmt24(cell.meeting_time)}` : ''}
                                </span>
                              )}
                              {cell.location && (
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', gap: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <MapPin style={{ width: 9, height: 9, flexShrink: 0 }} />
                                  {cell.location}
                                </span>
                              )}
                            </div>
                          </div>

                          <ChevronRight style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

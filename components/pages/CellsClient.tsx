'use client'

import { useState } from 'react'
import Link from 'next/link'
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

export default function CellsClient({ cells, slug }: { cells: Cell[]; slug: string; churchId: string }) {
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

  const [expanded, setExpanded] = useState<Set<string>>(new Set(sortedGroups))

  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(200,169,107,0.12)',
            border: '0.5px solid var(--aq-border)',
          }}>
            <Users style={{ width: 18, height: 18, color: 'var(--aq-gold)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--aq-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>Cells</h1>
            <p style={{ fontSize: 13, color: 'var(--aq-text-tertiary)', margin: '2px 0 0' }}>
              {sortedGroups.length} group{sortedGroups.length !== 1 ? 's' : ''} · {cells.length} cells
            </p>
          </div>
        </div>
        <Link
          href={`/${slug}/cells/new`}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 12,
            background: 'var(--aq-gold)',
            fontSize: 13, fontWeight: 500, color: '#fff',
            textDecoration: 'none', letterSpacing: '-0.01em',
          }}
        >
          <Plus style={{ width: 15, height: 15 }} />
          New Cell
        </Link>
      </div>

      {/* Empty */}
      {cells.length === 0 && (
        <div style={{ borderRadius: 20, padding: '80px 0', textAlign: 'center', background: 'var(--aq-surface)', border: '1px dashed rgba(255,255,255,0.08)' }}>
          <Users style={{ width: 40, height: 40, color: 'var(--aq-text-muted)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, color: 'var(--aq-text-tertiary)', fontWeight: 500, margin: 0 }}>No cells yet</p>
          <Link href={`/${slug}/cells/new`} style={{ fontSize: 13, color: 'var(--aq-gold)', marginTop: 8, display: 'inline-block', textDecoration: 'none' }}>
            Create your first cell →
          </Link>
        </div>
      )}

      {/* Groups */}
      {cells.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sortedGroups.map(groupKey => {
            const groupCells = groupMap.get(groupKey)!
            const label      = groupKey === '__none__' ? 'Ungrouped' : groupKey
            const isOpen     = expanded.has(groupKey)

            return (
              <div key={groupKey} style={{
                borderRadius: 18,
                border: '0.5px solid var(--aq-border)',
                background: 'var(--aq-surface)',
                overflow: 'hidden',
              }}>
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
                    background: 'rgba(200,169,107,0.12)', border: '0.5px solid var(--aq-border)',
                  }}>
                    <Layers style={{ width: 15, height: 15, color: 'var(--aq-gold)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--aq-text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                      {label}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--aq-text-tertiary)', margin: '2px 0 0' }}>
                      {groupCells.length} cell{groupCells.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronDown style={{
                    width: 16, height: 16, color: 'var(--aq-text-tertiary)', flexShrink: 0,
                    transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 200ms ease',
                  }} />
                </button>

                {isOpen && (
                  <div style={{ borderTop: '0.5px solid var(--aq-border)', padding: '8px 12px 12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {groupCells.map(cell => (
                        <Link
                          key={cell.id}
                          href={`/${slug}/cells/${cell.id}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 12px', borderRadius: 12,
                            background: 'transparent', border: '1px solid transparent',
                            textDecoration: 'none', transition: 'background 150ms ease, border-color 150ms ease',
                          }}
                          onMouseEnter={e => {
                            const el = e.currentTarget as HTMLElement
                            el.style.background = 'var(--aq-elevated)'
                            el.style.borderColor = 'var(--aq-border)'
                          }}
                          onMouseLeave={e => {
                            const el = e.currentTarget as HTMLElement
                            el.style.background = 'transparent'
                            el.style.borderColor = 'transparent'
                          }}
                        >
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                            background: cell.color,
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--aq-text-primary)', margin: 0, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {cell.name}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                              {cell.leader_name && (
                                <span style={{ fontSize: 11, color: 'var(--aq-text-tertiary)' }}>{cell.leader_name}</span>
                              )}
                              {cell.meeting_day !== null && (
                                <span style={{ fontSize: 11, color: 'var(--aq-text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Clock style={{ width: 9, height: 9 }} />
                                  Every {DAY_NAMES[cell.meeting_day]}{cell.meeting_time ? ` · ${fmt24(cell.meeting_time)}` : ''}
                                </span>
                              )}
                              {cell.location && (
                                <span style={{ fontSize: 11, color: 'var(--aq-text-tertiary)', display: 'flex', alignItems: 'center', gap: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <MapPin style={{ width: 9, height: 9, flexShrink: 0 }} />
                                  {cell.location}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight style={{ width: 14, height: 14, color: 'var(--aq-text-muted)', flexShrink: 0 }} />
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

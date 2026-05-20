'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ROLES, roleColor, roleLabel, type Role } from '@/lib/roles'

export interface Member {
  id: string
  userId: string
  role: string
  status: string
  joinedVia: string | null
  createdAt: string
  email: string
  name: string
}

interface MemberRowProps {
  member: Member
  slug: string
  /** Receives the new role. Parent decides whether to commit or roll back. */
  onRoleChange: (membershipId: string, prevRole: string, nextRole: string) => Promise<{ ok: boolean; error?: string }>
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const day = 24 * 60 * 60 * 1000
  if (diffMs < day) return 'today'
  const days = Math.floor(diffMs / day)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export function MemberRow({ member, onRoleChange }: MemberRowProps) {
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [errorFlash, setErrorFlash] = useState('')

  async function changeRole(role: Role) {
    setOpen(false)
    if (role === member.role) return
    setSaving(true)
    setErrorFlash('')
    try {
      const result = await onRoleChange(member.id, member.role, role)
      if (!result.ok) {
        setErrorFlash(result.error ?? 'Update failed')
        setTimeout(() => setErrorFlash(''), 4000)
      }
    } finally {
      setSaving(false)
    }
  }

  const initials = member.name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const joinedLabel = member.joinedVia === 'access_key' ? 'key' : member.joinedVia ?? ''

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(129,140,248,0.12))', border: '1px solid rgba(129,140,248,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#a5b4fc', flexShrink: 0 }}>
        {initials || '?'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.88)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</p>
          {joinedLabel && (
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
              {joinedLabel}
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.32)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {member.email}
          {member.createdAt && (
            <span style={{ color: 'rgba(255,255,255,0.20)' }}> · joined {timeAgo(member.createdAt)}</span>
          )}
        </p>
        {errorFlash && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#f87171' }}>{errorFlash}</p>
        )}
      </div>

      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setOpen(v => !v)}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.05)',
            color: roleColor(member.role),
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.5 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          {saving ? '…' : roleLabel(member.role)}
          {!saving && <ChevronDown style={{ width: 11, height: 11 }} />}
        </button>

        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 20,
              background: '#111827', border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 12, overflow: 'hidden', minWidth: 130,
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            }}>
              {ROLES.map(r => (
                <button
                  key={r.value}
                  onClick={() => changeRole(r.value)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '9px 14px', fontSize: 13, fontWeight: r.value === member.role ? 700 : 500,
                    color: r.value === member.role ? r.color : 'rgba(255,255,255,0.65)',
                    background: r.value === member.role ? 'rgba(255,255,255,0.05)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = r.value === member.role ? 'rgba(255,255,255,0.05)' : 'transparent')}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

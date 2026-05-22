'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ROLES, roleColor, roleLabel, type Role } from '@/lib/roles'
import { Badge } from '@/components/ui'

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
  onRoleChange: (
    membershipId: string,
    prevRole: string,
    nextRole: string,
  ) => Promise<{ ok: boolean; error?: string }>
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

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 4px',
        borderBottom: '1px solid var(--ds-border)',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 11,
          background: 'linear-gradient(135deg, rgba(142,150,248,0.22), rgba(108,112,232,0.10))',
          border: '1px solid rgba(142,150,248,0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--ds-accent)',
          flexShrink: 0,
          letterSpacing: '0.02em',
        }}
      >
        {initials || '?'}
      </div>

      {/* Name + email + joined */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--ds-text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: '-0.005em',
            }}
          >
            {member.name}
          </p>
          {member.joinedVia === 'access_key' && (
            <Badge tone="neutral" style={{ height: 18, fontSize: 10 }}>via key</Badge>
          )}
        </div>
        <p
          style={{
            margin: '2px 0 0',
            fontSize: 12.5,
            color: 'var(--ds-text-tertiary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {member.email}
          {member.createdAt && (
            <span style={{ color: 'var(--ds-text-faint)' }}> · joined {timeAgo(member.createdAt)}</span>
          )}
        </p>
        {errorFlash && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--ds-danger)' }}>{errorFlash}</p>
        )}
      </div>

      {/* Role dropdown */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setOpen(v => !v)}
          disabled={saving}
          className="ds-btn ds-btn-secondary ds-btn-sm"
          style={{ color: roleColor(member.role), borderColor: 'var(--ds-border)' }}
        >
          {saving ? '…' : roleLabel(member.role)}
          {!saving && <ChevronDown style={{ width: 12, height: 12, opacity: 0.55 }} />}
        </button>

        {open && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 10 }}
              onClick={() => setOpen(false)}
            />
            <div
              className="ds-menu"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                zIndex: 20,
                minWidth: 140,
              }}
            >
              {ROLES.map(r => (
                <button
                  key={r.value}
                  onClick={() => changeRole(r.value)}
                  className={`ds-menu-item ${r.value === member.role ? 'ds-menu-item-active' : ''}`}
                  style={r.value === member.role ? { color: r.color } : undefined}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: r.color,
                      opacity: r.value === member.role ? 1 : 0.55,
                      flexShrink: 0,
                    }}
                  />
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

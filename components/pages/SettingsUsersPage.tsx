'use client'

import { useEffect, useState } from 'react'
import { Shield, Users, ChevronDown, Check } from 'lucide-react'
import { useUserProfile } from '@/lib/use-user-profile'
import { useRouter } from 'next/navigation'

interface AuthUser {
  id: string
  email: string
  name: string
  created_at: string
  profile: { role: string; group_id: string | null } | null
}

interface Group {
  id: string
  name: string
}

export default function UsersSettingsPage() {
  const { profile, loading: profileLoading } = useUserProfile()
  const router = useRouter()

  const [users, setUsers]   = useState<AuthUser[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)

  useEffect(() => {
    if (profileLoading) return
    if (profile?.role !== 'master') { router.replace('/'); return }
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => { setUsers(d.users ?? []); setGroups(d.groups ?? []) })
      .finally(() => setLoading(false))
  }, [profile, profileLoading, router])

  async function updateUser(userId: string, role: string, groupId: string | null) {
    setSaving(userId)
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, group_id: groupId }),
    })
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, profile: { role, group_id: groupId } } : u,
    ))
    setSaving(null)
  }

  if (profileLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-2 h-2 rounded-full animate-bounce"
              style={{ backgroundColor: 'rgba(200,169,107,0.50)', animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: 'rgba(200,169,107,0.25)',
            border: '0.5px solid var(--aq-border)',
          }}
        >
          <Shield className="w-5 h-5" style={{ color: 'var(--aq-gold)' }} />
        </div>
        <div>
          <h1 className="text-lg font-medium" style={{ color: 'var(--aq-text-primary)' }}>
            User Access
          </h1>
          <p className="text-sm" style={{ color: 'var(--aq-text-secondary)' }}>
            Assign roles and group access to staff members
          </p>
        </div>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: 'Master', desc: 'Sees all groups, all data, all conversations', color: 'var(--aq-gold)' },
          { label: 'Group', desc: 'Sees only their assigned group\'s data and messages', color: 'var(--aq-sage)' },
        ].map(r => (
          <div
            key={r.label}
            className="px-4 py-3 rounded-xl"
            style={{
              background: 'var(--aq-elevated)',
              border: '0.5px solid var(--aq-border)',
            }}
          >
            <span className="text-xs font-medium" style={{ color: r.color }}>{r.label}</span>
            <p className="text-xs mt-0.5" style={{ color: 'var(--aq-text-secondary)' }}>{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '0.5px solid var(--aq-border)', background: 'var(--aq-surface)' }}
      >
        <div
          className="flex items-center gap-2 px-5 py-3"
          style={{ borderBottom: '0.5px solid var(--aq-border)' }}
        >
          <Users className="w-4 h-4" style={{ color: 'var(--aq-text-secondary)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--aq-text-secondary)' }}>
            {users.length} user{users.length !== 1 ? 's' : ''}
          </span>
        </div>

        {users.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: 'var(--aq-text-tertiary)' }}>
            No users found
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {users.map(u => {
              const currentRole    = u.profile?.role ?? 'group'
              const currentGroupId = u.profile?.group_id ?? null
              const isSelf         = u.profile?.role === 'master' && users.filter(x => x.profile?.role === 'master').length === 1
              const isSavingThis   = saving === u.id

              return (
                <div key={u.id} className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-medium"
                    style={{
                      background: 'rgba(200,169,107,0.25)',
                      border: '0.5px solid var(--aq-border)',
                      color: 'var(--aq-gold)',
                    }}
                  >
                    {(u.name || u.email || '?')[0].toUpperCase()}
                  </div>

                  {/* Identity */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--aq-text-primary)' }}>
                      {u.name || u.email}
                    </p>
                    {u.name && (
                      <p className="text-xs truncate" style={{ color: 'var(--aq-text-tertiary)' }}>
                        {u.email}
                      </p>
                    )}
                  </div>

                  {/* Role selector */}
                  <div className="relative">
                    <select
                      disabled={isSelf || !!isSavingThis}
                      value={currentRole}
                      onChange={e => updateUser(u.id, e.target.value, e.target.value === 'master' ? null : currentGroupId)}
                      className="appearance-none text-xs font-medium px-3 py-1.5 pr-7 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: currentRole === 'master'
                          ? 'rgba(200,169,107,0.15)'
                          : 'rgba(127,168,135,0.12)',
                        border: currentRole === 'master'
                          ? '0.5px solid var(--aq-border)'
                          : '0.5px solid var(--aq-border)',
                        color: currentRole === 'master' ? 'var(--aq-gold)' : 'var(--aq-sage)',
                        outline: 'none',
                      }}
                    >
                      <option value="master">Master</option>
                      <option value="group">Group</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
                      style={{ color: currentRole === 'master' ? 'var(--aq-gold)' : 'var(--aq-sage)' }} />
                  </div>

                  {/* Group selector (only for group role) */}
                  {currentRole === 'group' && (
                    <div className="relative">
                      <select
                        disabled={!!isSavingThis}
                        value={currentGroupId ?? ''}
                        onChange={e => updateUser(u.id, 'group', e.target.value || null)}
                        className="appearance-none text-xs px-3 py-1.5 pr-7 rounded-lg cursor-pointer disabled:opacity-50"
                        style={{
                          background: 'var(--aq-elevated)',
                          border: '0.5px solid var(--aq-border)',
                          color: 'var(--aq-text-secondary)',
                          outline: 'none',
                          minWidth: '120px',
                        }}
                      >
                        <option value="">No group</option>
                        {groups.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
                        style={{ color: 'var(--aq-text-secondary)' }} />
                    </div>
                  )}

                  {/* Saved indicator */}
                  {isSavingThis ? (
                    <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin shrink-0"
                      style={{ borderColor: 'rgba(200,169,107,0.60)', borderTopColor: 'transparent' }} />
                  ) : u.profile ? (
                    <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--aq-sage)' }} />
                  ) : (
                    <span className="text-xs shrink-0" style={{ color: 'var(--aq-amber)' }}>Unassigned</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-xs mt-4 text-center" style={{ color: 'var(--aq-text-muted)' }}>
        Changes take effect immediately on next page load.
      </p>
    </div>
  )
}

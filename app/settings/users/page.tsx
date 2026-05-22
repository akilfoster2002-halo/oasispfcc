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
              style={{ backgroundColor: 'rgba(201,168,76,0.50)', animationDelay: `${i * 0.15}s` }} />
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
            background: 'linear-gradient(135deg, rgba(201,168,76,0.25) 0%, rgba(201,168,76,0.15) 100%)',
            border: '1px solid rgba(201,168,76,0.25)',
          }}
        >
          <Shield className="w-5 h-5" style={{ color: '#C9A84C' }} />
        </div>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>
            User Access
          </h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>
            Assign roles and group access to staff members
          </p>
        </div>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: 'Master', desc: 'Sees all groups, all data, all conversations', color: '#C9A84C' },
          { label: 'Group', desc: 'Sees only their assigned group\'s data and messages', color: '#34d399' },
        ].map(r => (
          <div
            key={r.label}
            className="px-4 py-3 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span className="text-xs font-bold" style={{ color: r.color }}>{r.label}</span>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,12,26,0.55)' }}
      >
        <div
          className="flex items-center gap-2 px-5 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Users className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.40)' }} />
          <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.60)' }}>
            {users.length} user{users.length !== 1 ? 's' : ''}
          </span>
        </div>

        {users.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: 'rgba(255,255,255,0.30)' }}>
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
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
                    style={{
                      background: 'linear-gradient(135deg, rgba(201,168,76,0.25) 0%, rgba(201,168,76,0.15) 100%)',
                      border: '1px solid rgba(201,168,76,0.20)',
                      color: '#C9A84C',
                    }}
                  >
                    {(u.name || u.email || '?')[0].toUpperCase()}
                  </div>

                  {/* Identity */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                      {u.name || u.email}
                    </p>
                    {u.name && (
                      <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
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
                          ? 'rgba(201,168,76,0.15)'
                          : 'rgba(52,211,153,0.12)',
                        border: currentRole === 'master'
                          ? '1px solid rgba(201,168,76,0.30)'
                          : '1px solid rgba(52,211,153,0.25)',
                        color: currentRole === 'master' ? '#C9A84C' : '#34d399',
                        outline: 'none',
                      }}
                    >
                      <option value="master">Master</option>
                      <option value="group">Group</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
                      style={{ color: currentRole === 'master' ? '#C9A84C' : '#34d399' }} />
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
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: 'rgba(255,255,255,0.70)',
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
                        style={{ color: 'rgba(255,255,255,0.40)' }} />
                    </div>
                  )}

                  {/* Saved indicator */}
                  {isSavingThis ? (
                    <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin shrink-0"
                      style={{ borderColor: 'rgba(201,168,76,0.60)', borderTopColor: 'transparent' }} />
                  ) : u.profile ? (
                    <Check className="w-4 h-4 shrink-0" style={{ color: 'rgba(52,211,153,0.60)' }} />
                  ) : (
                    <span className="text-xs shrink-0" style={{ color: 'rgba(255,165,0,0.70)' }}>Unassigned</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-xs mt-4 text-center" style={{ color: 'rgba(255,255,255,0.20)' }}>
        Changes take effect immediately on next page load.
      </p>
    </div>
  )
}

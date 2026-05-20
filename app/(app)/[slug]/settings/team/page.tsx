'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Key, Users, Search } from 'lucide-react'
import { ROLES } from '@/lib/roles'
import { AccessKeyCard } from './AccessKeyCard'
import { MemberRow, type Member } from './MemberRow'

export default function TeamPage() {
  const params = useParams()
  const slug = params.slug as string

  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch(`/api/churches/${slug}/members`)
      .then(r => r.json())
      .then(d => setMembers(d.members ?? []))
      .finally(() => setMembersLoading(false))
  }, [slug])

  // Optimistic update with server rollback. If the PATCH fails, restore prevRole
  // and surface the error string to MemberRow for inline display.
  async function handleRoleChange(membershipId: string, prevRole: string, nextRole: string) {
    setMembers(prev => prev.map(m => (m.id === membershipId ? { ...m, role: nextRole } : m)))
    try {
      const res = await fetch(`/api/churches/${slug}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId, role: nextRole }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMembers(prev => prev.map(m => (m.id === membershipId ? { ...m, role: prevRole } : m)))
        return { ok: false, error: data.error ?? `Update failed (${res.status})` }
      }
      return { ok: true }
    } catch {
      setMembers(prev => prev.map(m => (m.id === membershipId ? { ...m, role: prevRole } : m)))
      return { ok: false, error: 'Network error. Please retry.' }
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q),
    )
  }, [members, query])

  return (
    <div style={{ padding: '28px 32px', maxWidth: 600, fontFamily: 'var(--font-geist-sans, system-ui)' }}>

      {/* Access Key */}
      <SectionHeader
        icon={<Key style={{ width: 18, height: 18, color: '#818cf8' }} />}
        iconBg="linear-gradient(135deg, rgba(99,102,241,0.22), rgba(129,140,248,0.12))"
        iconBorder="rgba(129,140,248,0.25)"
        title="Church Access Key"
        subtitle="Share with members so they can join"
      />
      <AccessKeyCard slug={slug} />

      {/* Members */}
      <SectionHeader
        icon={<Users style={{ width: 18, height: 18, color: '#34d399' }} />}
        iconBg="linear-gradient(135deg, rgba(52,211,153,0.15), rgba(16,185,129,0.08))"
        iconBorder="rgba(52,211,153,0.20)"
        title="Team Members"
        subtitle={membersLoading ? 'Loading…' : `${members.length} member${members.length !== 1 ? 's' : ''}`}
        marginTop={8}
      />

      {!membersLoading && members.length > 5 && (
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search members"
            style={{
              width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10, fontSize: 13,
              outline: 'none', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      <div style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '4px 20px' }}>
        {membersLoading ? (
          <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
            {members.length === 0 ? 'No members yet' : 'No matches'}
          </p>
        ) : (
          filtered.map(m => (
            <MemberRow key={m.id} member={m} slug={slug} onRoleChange={handleRoleChange} />
          ))
        )}
      </div>

      {/* Role legend */}
      <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {ROLES.map(r => (
          <div key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.color }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>{r.label}</span>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function SectionHeader({
  icon, iconBg, iconBorder, title, subtitle, marginTop = 0,
}: {
  icon: React.ReactNode
  iconBg: string
  iconBorder: string
  title: string
  subtitle: string
  marginTop?: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, marginTop }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: iconBg, border: `1px solid ${iconBorder}` }}>
        {icon}
      </div>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.92)', margin: 0 }}>{title}</h2>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>{subtitle}</p>
      </div>
    </div>
  )
}

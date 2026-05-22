'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import { Key, Users, Search } from 'lucide-react'
import { ROLES } from '@/lib/roles'
import { Card, Input, Skeleton } from '@/components/ui'
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
    <div
      className="ds-fade-up"
      style={{
        padding: '36px 32px',
        maxWidth: 680,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 36,
      }}
    >
      {/* Access Key section */}
      <section>
        <SectionHeader
          icon={<Key style={{ width: 18, height: 18, color: 'var(--ds-accent)' }} />}
          iconTone="accent"
          title="Church access key"
          subtitle="Share with members so they can join your workspace"
        />
        <AccessKeyCard slug={slug} />
      </section>

      {/* Members section */}
      <section>
        <SectionHeader
          icon={<Users style={{ width: 18, height: 18, color: 'var(--ds-success)' }} />}
          iconTone="success"
          title="Team members"
          subtitle={membersLoading ? 'Loading…' : `${members.length} ${members.length === 1 ? 'person' : 'people'}`}
        />

        {!membersLoading && members.length > 5 && (
          <div style={{ marginBottom: 14 }}>
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search members"
              leftAdornment={<Search style={{ width: 14, height: 14 }} />}
            />
          </div>
        )}

        <Card padding="6px 22px">
          {membersLoading ? (
            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Skeleton width={40} height={40} radius={11} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Skeleton width="40%" height={13} />
                    <Skeleton width="65%" height={11} />
                  </div>
                  <Skeleton width={70} height={28} radius={8} />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--ds-text-tertiary)' }}>
              {members.length === 0 ? 'No members yet. Share your access key to invite people.' : 'No matches.'}
            </p>
          ) : (
            filtered.map(m => (
              <MemberRow key={m.id} member={m} slug={slug} onRoleChange={handleRoleChange} />
            ))
          )}
        </Card>

        {/* Role legend */}
        <div style={{ marginTop: 14, display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {ROLES.map(r => (
            <div key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.color }} />
              <span style={{ fontSize: 11, color: 'var(--ds-text-tertiary)', letterSpacing: '0.01em' }}>{r.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

interface SectionHeaderProps {
  icon: ReactNode
  iconTone: 'accent' | 'success'
  title: string
  subtitle: string
}

function SectionHeader({ icon, iconTone, title, subtitle }: SectionHeaderProps) {
  const tints =
    iconTone === 'accent'
      ? { bg: 'var(--ds-accent-soft)', border: 'var(--ds-accent-line)' }
      : { bg: 'var(--ds-success-soft)', border: 'rgba(90,209,153,0.22)' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 11,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: tints.bg,
          border: `1px solid ${tints.border}`,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <h2
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--ds-text)',
            margin: 0,
            letterSpacing: '-0.015em',
            fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui',
          }}
        >
          {title}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ds-text-tertiary)', margin: '2px 0 0' }}>{subtitle}</p>
      </div>
    </div>
  )
}

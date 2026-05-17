'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle, XCircle, Clock, Shield } from 'lucide-react'

interface MemberRow {
  id: string
  user_id: string
  email: string
  name: string
  role: string
  status: string
  joined_via: string
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  suspended: 'bg-orange-100 text-orange-700',
}

const ROLES = ['member', 'volunteer', 'leader', 'pastor', 'admin']

export default function ApprovalsPage() {
  const params = useParams()
  const slug = params.slug as string

  const [churchId, setChurchId] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Fetch church ID from slug
  useEffect(() => {
    fetch(`/api/churches/${slug}`)
      .then(r => r.json())
      .then(({ church }) => setChurchId(church?.id ?? null))
  }, [slug])

  useEffect(() => {
    if (!churchId) return
    setLoading(true)
    fetch(`/api/admin/approvals?churchId=${churchId}`)
      .then(r => r.json())
      .then(({ memberships }) => setMembers(memberships ?? []))
      .finally(() => setLoading(false))
  }, [churchId])

  async function handleAction(membershipId: string, action: 'approve' | 'reject' | 'suspend', role?: string) {
    if (!churchId) return
    setActionLoading(membershipId + action)
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId, action, role, churchId }),
      })
      if (res.ok) {
        const { membership } = await res.json()
        setMembers(prev => prev.map(m => m.id === membershipId ? { ...m, ...membership } : m))
      }
    } finally {
      setActionLoading(null)
    }
  }

  const displayed = filter === 'pending'
    ? members.filter(m => m.status === 'pending')
    : members

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(129,140,248,0.15))', border: '1px solid rgba(129,140,248,0.25)' }}>
          <Shield className="w-5 h-5" style={{ color: '#818cf8' }} />
        </div>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>
            Member Approvals
          </h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>
            Approve, reject, or manage church memberships
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(['pending', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-1.5 text-sm font-medium rounded-full transition-all"
            style={{
              background: filter === f ? 'rgba(99,102,241,0.20)' : 'rgba(255,255,255,0.05)',
              border: filter === f ? '1px solid rgba(129,140,248,0.30)' : '1px solid rgba(255,255,255,0.08)',
              color: filter === f ? '#818cf8' : 'rgba(255,255,255,0.45)',
            }}
          >
            {f === 'pending' ? `Pending (${members.filter(m => m.status === 'pending').length})` : 'All Members'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.30)' }}>
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No {filter === 'pending' ? 'pending requests' : 'members'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(m => (
            <div
              key={m.id}
              className="flex items-center gap-4 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}
              >
                {(m.name || m.email).slice(0, 2).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                  {m.name || '—'}
                </p>
                <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.40)' }}>
                  {m.email} · via {m.joined_via}
                </p>
              </div>

              {/* Status badge */}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[m.status] ?? ''}`}>
                {m.status}
              </span>

              {/* Actions */}
              {m.status === 'pending' && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleAction(m.id, 'approve', 'member')}
                    disabled={actionLoading !== null}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                    style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(m.id, 'reject')}
                    disabled={actionLoading !== null}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                    style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              )}

              {m.status === 'approved' && (
                <button
                  onClick={() => handleAction(m.id, 'suspend')}
                  disabled={actionLoading !== null}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.40)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  Suspend
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

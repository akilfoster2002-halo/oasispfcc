'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Send, Trash2, Users, Copy, Check } from 'lucide-react'

interface Invite {
  id: string
  email: string
  role: string
  status: string
  created_at: string
  expires_at: string
}

const ROLES = ['member', 'volunteer', 'leader', 'pastor', 'admin'] as const

const STATUS_STYLE: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  revoked:  'bg-red-100 text-red-700',
}

export default function TeamPage() {
  const params = useParams()
  const slug = params.slug as string

  const [churchId, setChurchId] = useState<string | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<typeof ROLES[number]>('member')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [lastLink, setLastLink] = useState('')
  const [copied, setCopied] = useState(false)

  // Fetch church ID
  useEffect(() => {
    fetch(`/api/churches/${slug}`)
      .then(r => r.json())
      .then(({ church }) => setChurchId(church?.id ?? null))
  }, [slug])

  // Fetch invites
  useEffect(() => {
    if (!churchId) return
    setLoading(true)
    fetch(`/api/invites?churchId=${churchId}`)
      .then(r => r.json())
      .then(({ invites: inv }) => setInvites(inv ?? []))
      .finally(() => setLoading(false))
  }, [churchId])

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!churchId) { setSendError('Church not loaded yet — please wait a moment and try again.'); return }
    setSendError('')
    setSending(true)
    setLastLink('')
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ churchId, email, role }),
      })
      const data = await res.json()
      if (!res.ok) { setSendError(data.error ?? 'Failed to send invite'); return }
      setLastLink(data.inviteUrl)
      setEmail('')
      fetch(`/api/invites?churchId=${churchId}`)
        .then(r => r.json())
        .then(({ invites: inv }) => setInvites(inv ?? []))
    } catch {
      setSendError('Network error — please try again.')
    } finally {
      setSending(false)
    }
  }

  async function revokeInvite(inviteId: string) {
    if (!churchId) return
    await fetch(`/api/invites?inviteId=${inviteId}&churchId=${churchId}`, { method: 'DELETE' })
    setInvites(prev => prev.map(i => i.id === inviteId ? { ...i, status: 'revoked' } : i))
  }

  function copyLink() {
    navigator.clipboard.writeText(lastLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.88)',
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(129,140,248,0.15))', border: '1px solid rgba(129,140,248,0.25)' }}>
          <Users className="w-5 h-5" style={{ color: '#818cf8' }} />
        </div>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>Team & Invites</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>
            Invite people to your church by email
          </p>
        </div>
      </div>

      {/* Invite form */}
      <div className="p-5 rounded-2xl mb-6"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.75)' }}>
          Send an invite
        </h2>
        <form onSubmit={sendInvite} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="member@church.org"
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
            style={inputStyle}
          />
          <select
            value={role}
            onChange={e => setRole(e.target.value as typeof ROLES[number])}
            className="px-4 py-2.5 rounded-xl text-sm outline-none capitalize"
            style={inputStyle}
          >
            {ROLES.map(r => <option key={r} value={r} style={{ background: '#0a0e23' }}>{r}</option>)}
          </select>
          <button
            type="submit"
            disabled={sending || !churchId}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shrink-0 transition-all"
            style={{
              background: sending || !churchId ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
              color: sending || !churchId ? 'rgba(255,255,255,0.35)' : '#fff',
              cursor: sending || !churchId ? 'not-allowed' : 'pointer',
              opacity: 1,
            }}
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending…' : 'Send Invite'}
          </button>
        </form>

        {sendError && (
          <p className="mt-3 text-xs" style={{ color: '#f87171' }}>{sendError}</p>
        )}

        {lastLink && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-xl"
            style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.20)' }}>
            <p className="flex-1 text-xs truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Invite sent! Link: <span style={{ color: '#34d399' }}>{lastLink}</span>
            </p>
            <button onClick={copyLink}
              className="flex items-center gap-1 text-xs font-medium shrink-0"
              style={{ color: copied ? '#34d399' : 'rgba(255,255,255,0.45)' }}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {/* Invite list */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Sent invites
        </h2>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        ) : invites.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
            No invites sent yet
          </p>
        ) : (
          <div className="space-y-2">
            {invites.map(inv => (
              <div key={inv.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    {inv.email}
                  </p>
                  <p className="text-xs mt-0.5 capitalize" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {inv.role} · sent {new Date(inv.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 capitalize ${STATUS_STYLE[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {inv.status}
                </span>
                {inv.status === 'pending' && (
                  <button
                    onClick={() => revokeInvite(inv.id)}
                    className="shrink-0 p-1.5 rounded-lg transition-colors"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                    title="Revoke invite"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

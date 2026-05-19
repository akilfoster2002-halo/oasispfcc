'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageSquare, Send, Check, X, Loader2, Search,
  ArrowLeft, UserCheck, Clock, Edit3, ChevronDown,
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface FollowUp {
  id: string
  person_name: string
  phone: string | null
  event_name: string
  event_date: string
  message: string
  status: 'pending' | 'sent' | 'dismissed'
  created_at: string
}

interface Conversation {
  id: string
  phone: string
  name: string
  last_message_at: string | null
  person_id: string | null
}

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  sent_at: string | null
  created_at: string
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)',
  border: '1px solid rgba(255,255,255,0.065)',
  borderRadius: 18,
  boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 8px 24px rgba(0,0,0,0.25)',
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtTs(ts: string) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ─── Follow-up card ───────────────────────────────────────────────────────────

function FollowUpCard({
  item, onSent, onDismiss,
}: {
  item: FollowUp
  onSent: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.message)
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState<'send' | 'dismiss' | null>(null)

  async function saveEdit() {
    setSaving(true)
    await fetch(`/api/follow-ups/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: draft }),
    })
    setSaving(false)
    setEditing(false)
  }

  async function markSent() {
    setActionLoading('send')
    await fetch(`/api/follow-ups/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent' }),
    })
    onSent(item.id)
  }

  async function dismiss() {
    setActionLoading('dismiss')
    await fetch(`/api/follow-ups/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed' }),
    })
    onDismiss(item.id)
  }

  return (
    <div style={{ ...card, padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.30) 0%, rgba(129,140,248,0.20) 100%)',
          border: '1px solid rgba(129,140,248,0.28)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: '#a5b4fc',
        }}>
          {item.person_name.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.90)', margin: 0 }}>
            {item.person_name}
          </p>
          {item.phone && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '1px 0 0' }}>{item.phone}</p>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99,
            background: 'rgba(129,140,248,0.12)', color: '#818cf8',
            border: '1px solid rgba(129,140,248,0.22)',
          }}>
            First Timer
          </span>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', margin: '4px 0 0' }}>
            {item.event_name} · {fmtDate(item.event_date)}
          </p>
        </div>
      </div>

      {/* Message body */}
      {editing ? (
        <div style={{ marginBottom: 14 }}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={4}
            autoFocus
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 12, fontSize: 13,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,102,241,0.40)',
              color: 'rgba(255,255,255,0.88)', outline: 'none', resize: 'vertical',
              boxSizing: 'border-box', lineHeight: 1.6,
              boxShadow: '0 0 0 3px rgba(99,102,241,0.10)',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={saveEdit}
              disabled={saving}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: 'rgba(99,102,241,0.20)', border: '1px solid rgba(99,102,241,0.35)',
                color: '#a5b4fc', cursor: 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setDraft(item.message) }}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.45)', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          padding: '12px 14px', borderRadius: 12, marginBottom: 14,
          background: 'rgba(255,255,255,0.028)', border: '1px solid rgba(255,255,255,0.055)',
          fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.65,
          whiteSpace: 'pre-wrap',
        }}>
          {draft}
        </div>
      )}

      {/* Actions */}
      {!editing && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={markSent}
            disabled={actionLoading !== null}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
              color: '#fff', border: 'none', cursor: actionLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 3px 10px rgba(99,102,241,0.35)',
              opacity: actionLoading === 'send' ? 0.65 : 1,
              transition: 'opacity 0.12s ease',
            }}
          >
            {actionLoading === 'send'
              ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 0.8s linear infinite' }} />
              : <Send style={{ width: 13, height: 13 }} />}
            Mark as Sent
          </button>
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
            }}
          >
            <Edit3 style={{ width: 13, height: 13 }} />
          </button>
          <button
            onClick={dismiss}
            disabled={actionLoading !== null}
            style={{
              padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.35)', cursor: actionLoading ? 'not-allowed' : 'pointer',
              opacity: actionLoading === 'dismiss' ? 0.65 : 1,
            }}
          >
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MessagingPage({ churchId }: { churchId: string }) {
  const [tab, setTab] = useState<'followup' | 'conversations'>('followup')

  // Follow-up state
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [fuLoading, setFuLoading] = useState(true)
  const [showSent, setShowSent] = useState(false)

  // Conversation state
  const [convs, setConvs] = useState<Conversation[]>([])
  const [convLoading, setConvLoading] = useState(false)
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [convSearch, setConvSearch] = useState('')
  const msgBottom = useRef<HTMLDivElement>(null)

  // Load follow-ups
  useEffect(() => {
    if (!churchId) return
    setFuLoading(true)
    fetch(`/api/follow-ups?church_id=${churchId}&status=${showSent ? 'sent' : 'pending'}`)
      .then(r => r.json())
      .then(d => { setFollowUps(Array.isArray(d) ? d : []); setFuLoading(false) })
      .catch(() => setFuLoading(false))
  }, [churchId, showSent])

  // Load conversations
  useEffect(() => {
    if (tab !== 'conversations' || !churchId) return
    setConvLoading(true)
    fetch(`/api/messaging/conversations?church_id=${churchId}`)
      .then(r => r.json())
      .then(d => { setConvs(Array.isArray(d) ? d : []); setConvLoading(false) })
      .catch(() => setConvLoading(false))
  }, [tab, churchId])

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConv) return
    setMsgLoading(true)
    fetch(`/api/messaging/conversations/${activeConv.id}`)
      .then(r => r.json())
      .then(d => { setMessages(Array.isArray(d) ? d : (d.messages ?? [])); setMsgLoading(false) })
      .catch(() => setMsgLoading(false))
  }, [activeConv])

  useEffect(() => {
    msgBottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function removeFollowUp(id: string) {
    setFollowUps(prev => prev.filter(f => f.id !== id))
  }

  const filteredConvs = convs.filter(c =>
    c.name.toLowerCase().includes(convSearch.toLowerCase()) ||
    c.phone.includes(convSearch)
  )

  const tabBtn = (t: typeof tab, label: string, count?: number) => (
    <button
      onClick={() => setTab(t)}
      style={{
        padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500,
        border: 'none', cursor: 'pointer', transition: 'all 0.12s ease',
        background: tab === t ? 'rgba(99,102,241,0.18)' : 'transparent',
        color: tab === t ? '#a5b4fc' : 'rgba(255,255,255,0.40)',
        outline: tab === t ? '1px solid rgba(129,140,248,0.30)' : '1px solid transparent',
      }}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span style={{
          marginLeft: 6, padding: '1px 6px', borderRadius: 99, fontSize: 11, fontWeight: 700,
          background: 'rgba(99,102,241,0.25)', color: '#818cf8',
        }}>
          {count}
        </span>
      )}
    </button>
  )

  return (
    <div style={{ padding: '24px 24px 80px', maxWidth: 720, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.018em', color: 'rgba(255,255,255,0.92)', margin: '0 0 4px' }}>
          Messaging
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: 0 }}>
          Follow up with first-timers and manage conversations
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.065)', borderRadius: 14, padding: 4, width: 'fit-content' }}>
        {tabBtn('followup', 'Follow Up', followUps.length)}
        {tabBtn('conversations', 'Conversations')}
      </div>

      {/* ── Follow Up tab ── */}
      {tab === 'followup' && (
        <div>
          {/* Sent toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)', margin: 0 }}>
              {fuLoading ? 'Loading…' : showSent ? `${followUps.length} sent` : followUps.length === 0 ? 'No pending follow-ups' : `${followUps.length} awaiting follow-up`}
            </p>
            <button
              onClick={() => setShowSent(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.40)', cursor: 'pointer',
              }}
            >
              <Clock style={{ width: 12, height: 12 }} />
              {showSent ? 'Show Pending' : 'Show Sent'}
            </button>
          </div>

          {fuLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="shimmer" style={{ height: 180, borderRadius: 18, background: 'rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          ) : followUps.length === 0 ? (
            <div style={{
              padding: '48px 24px', textAlign: 'center', borderRadius: 20,
              border: '1px dashed rgba(255,255,255,0.08)',
            }}>
              <UserCheck style={{ width: 32, height: 32, color: 'rgba(255,255,255,0.12)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.35)', margin: '0 0 6px' }}>
                {showSent ? 'No sent follow-ups yet' : 'No pending follow-ups'}
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.22)', margin: 0 }}>
                {showSent ? 'Sent messages will appear here.' : 'When a first-timer checks in, a draft message will appear here for you to review and send.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {followUps.map(f => (
                <FollowUpCard
                  key={f.id}
                  item={f}
                  onSent={removeFollowUp}
                  onDismiss={removeFollowUp}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Conversations tab ── */}
      {tab === 'conversations' && (
        <div>
          {activeConv ? (
            /* Thread view */
            <div style={{ ...card, display: 'flex', flexDirection: 'column', height: 560 }}>
              {/* Thread header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.055)', flexShrink: 0 }}>
                <button
                  onClick={() => { setActiveConv(null); setMessages([]) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(255,255,255,0.45)' }}
                >
                  <ArrowLeft style={{ width: 16, height: 16 }} />
                </button>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(99,102,241,0.20)', border: '1px solid rgba(129,140,248,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#a5b4fc', flexShrink: 0 }}>
                  {activeConv.name.charAt(0)}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.88)', margin: 0 }}>{activeConv.name}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', margin: 0 }}>{activeConv.phone}</p>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {msgLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
                    <Loader2 style={{ width: 20, height: 20, color: 'rgba(255,255,255,0.25)', animation: 'spin 0.8s linear infinite' }} />
                  </div>
                ) : messages.length === 0 ? (
                  <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.25)', marginTop: 40 }}>No messages yet</p>
                ) : messages.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: m.direction === 'outbound' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '72%', padding: '9px 13px', borderRadius: 14,
                      fontSize: 13, lineHeight: 1.55,
                      background: m.direction === 'outbound' ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' : 'rgba(255,255,255,0.07)',
                      color: m.direction === 'outbound' ? '#fff' : 'rgba(255,255,255,0.80)',
                      border: m.direction === 'inbound' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                    }}>
                      {m.body}
                      <p style={{ fontSize: 10, opacity: 0.55, margin: '4px 0 0', textAlign: 'right' }}>
                        {fmtTs(m.sent_at ?? m.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={msgBottom} />
              </div>

              {/* Reply bar */}
              <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.055)', flexShrink: 0, display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && reply.trim() && (() => {/* send */})()}
                  placeholder="Type a message…"
                  style={{
                    flex: 1, padding: '9px 14px', borderRadius: 10, fontSize: 13, outline: 'none',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
                    color: 'rgba(255,255,255,0.88)',
                  }}
                />
                <button
                  disabled={!reply.trim() || sending}
                  style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: reply.trim() ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' : 'rgba(255,255,255,0.06)',
                    border: 'none', cursor: reply.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Send style={{ width: 15, height: 15, color: reply.trim() ? '#fff' : 'rgba(255,255,255,0.25)' }} />
                </button>
              </div>
            </div>
          ) : (
            /* Conversation list */
            <div>
              {/* Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 12, marginBottom: 16, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.075)' }}>
                <Search style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.28)', flexShrink: 0 }} />
                <input
                  type="text" value={convSearch} onChange={e => setConvSearch(e.target.value)}
                  placeholder="Search conversations…"
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'rgba(255,255,255,0.80)' }}
                />
              </div>

              {convLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} className="shimmer" style={{ height: 64, borderRadius: 14, background: 'rgba(255,255,255,0.04)' }} />
                  ))}
                </div>
              ) : filteredConvs.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 18 }}>
                  <MessageSquare style={{ width: 28, height: 28, color: 'rgba(255,255,255,0.12)', margin: '0 auto 10px' }} />
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)', margin: 0 }}>No conversations yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {filteredConvs.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setActiveConv(c)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px', borderRadius: 14, textAlign: 'left', width: '100%',
                        background: 'rgba(255,255,255,0.030)', border: '1px solid rgba(255,255,255,0.055)',
                        cursor: 'pointer', transition: 'background 0.10s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.055)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.030)')}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(129,140,248,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#a5b4fc' }}>
                        {c.name.charAt(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', margin: 0 }}>{c.phone}</p>
                      </div>
                      {c.last_message_at && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                          {fmtTs(c.last_message_at)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

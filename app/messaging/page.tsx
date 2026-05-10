'use client'

import { useState, useEffect, useRef } from 'react'
import {
  MessageSquare, Send, Sparkles, RefreshCw, ArrowLeft,
  Check, X, Loader2, Plus, Search, Bot, Zap, Users,
  Edit3, Trash2, CheckCircle, AlertTriangle,
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

// Single shared client — never recreate inside components
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string
  phone: string
  name: string
  status: string | null
  is_sensitive: boolean
  last_message_at: string | null
  attendee_id: string | null
}

interface Message {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  body: string
  ai_generated: boolean
  approved: boolean
  sent_at: string | null
  created_at: string
  tone: string | null
  pastoral_note: string | null
  is_sensitive: boolean
}

interface Recipient {
  attendee_id: string
  name: string
  phone: string
  generated_message: string
}

interface CampaignPreview {
  campaignName: string
  insight: string
  messageTemplate: string
  recipients: Recipient[]
}

interface Campaign {
  id: string
  name: string
  command: string
  status: 'draft' | 'approved' | 'sending' | 'sent' | 'failed'
  total_recipients: number
  sent_count: number
  created_at: string
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function GlassCard({ children, className = '', style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties
}) {
  return (
    <div className={className} style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, ...style,
    }}>
      {children}
    </div>
  )
}

function CampaignStatusBadge({ status }: { status: Campaign['status'] }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    draft:    { label: 'Draft',    color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
    approved: { label: 'Approved', color: '#34d399', bg: 'rgba(52,211,153,0.15)'  },
    sending:  { label: 'Sending',  color: '#fbbf24', bg: 'rgba(251,191,36,0.15)'  },
    sent:     { label: 'Sent',     color: '#818cf8', bg: 'rgba(129,140,248,0.15)' },
    failed:   { label: 'Failed',   color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
  }
  const s = map[status] ?? map.draft
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, color: s.color, background: s.bg }}>
      {s.label}
    </span>
  )
}

// ─── New Message Modal ────────────────────────────────────────────────────────

interface Attendee { id: string; name: string; phone: string | null }

function NewMessageModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Attendee[]>([])
  const [selected, setSelected] = useState<Attendee | null>(null)
  const [messageBody, setMessageBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/people/search?q=${encodeURIComponent(query)}&hasPhone=true`)
      if (res.ok) setResults(await res.json())
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  async function send() {
    if (!selected?.phone || !messageBody.trim()) return
    setSending(true); setError('')
    try {
      const res = await fetch('/api/messaging/new-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendee_id: selected.id, name: selected.name, phone: selected.phone, body: messageBody }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      onSent()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setSending(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'linear-gradient(135deg, rgba(15,19,40,0.98), rgba(10,14,30,0.99))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3">
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus className="w-4 h-4 text-white" /></div>
            <span className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>New Message</span>
          </div>
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>To</label>
            {selected ? (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{selected.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>{selected.name}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{selected.phone}</p>
                </div>
                <button onClick={() => { setSelected(null); setQuery('') }} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name..." className="w-full text-sm outline-none" style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.85)' }} />
                {results.length > 0 && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 10, background: 'rgba(12,16,36,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                    {results.map(a => (
                      <button key={a.id} onClick={() => { setSelected(a); setQuery(''); setResults([]) }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(129,140,248,0.08)')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{a.name.charAt(0)}</div>
                        <div>
                          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{a.name}</p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{a.phone}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Message</label>
            <textarea value={messageBody} onChange={e => setMessageBody(e.target.value)} rows={4} placeholder="Type your message..." className="w-full text-sm outline-none resize-none" style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }} />
            <p style={{ fontSize: 11, color: messageBody.length > 160 ? '#f87171' : 'rgba(255,255,255,0.25)', textAlign: 'right', marginTop: 4 }}>{messageBody.length} / 160</p>
          </div>
          {error && <p style={{ fontSize: 12, color: '#f87171' }}>{error}</p>}
          <button onClick={send} disabled={!selected || !messageBody.trim() || sending} style={{ padding: 11, borderRadius: 10, fontSize: 14, fontWeight: 600, background: selected && messageBody.trim() ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(255,255,255,0.06)', border: 'none', color: selected && messageBody.trim() ? '#fff' : 'rgba(255,255,255,0.3)', cursor: selected && messageBody.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.2s' }}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Message
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AI Draft Card ────────────────────────────────────────────────────────────

const TONES = ['Warm', 'Encouraging', 'Pastoral', 'Direct'] as const

function AIDraftCard({
  message, conversationId,
  onApprove, onDiscard, onRegenerate,
}: {
  message: Message
  conversationId: string
  onApprove: (msg: Message, editedBody?: string) => Promise<void>
  onDiscard: (msg: Message) => Promise<void>
  onRegenerate: (msg: Message, tone?: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [editedBody, setEditedBody] = useState(message.body)
  const [sending, setSending] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const activeTone = message.tone?.toLowerCase()

  async function approve() {
    setSending(true)
    try { await onApprove(message, editing ? editedBody : undefined) }
    finally { setSending(false) }
  }

  async function regen(tone?: string) {
    setRegenerating(true)
    try { await onRegenerate(message, tone) }
    finally { setRegenerating(false) }
  }

  function startEdit() {
    setEditing(true)
    setTimeout(() => textareaRef.current?.focus(), 40)
  }

  return (
    <div style={{ margin: '6px 0 4px', padding: '14px 16px', borderRadius: 16, border: '1px solid rgba(129,140,248,0.35)', background: 'linear-gradient(135deg, rgba(99,102,241,0.07), rgba(139,92,246,0.03))' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div style={{ width: 20, height: 20, borderRadius: 6, background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Sparkles className="w-2.5 h-2.5 text-white" />
        </div>
        <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 700, letterSpacing: '0.05em' }}>AI DRAFT</span>
        {message.is_sensitive && (
          <span style={{ fontSize: 10, color: '#fbbf24', background: 'rgba(251,191,36,0.12)', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>⚠ Sensitive</span>
        )}
        {message.tone && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 1 }}>· {message.tone.charAt(0).toUpperCase() + message.tone.slice(1)}</span>
        )}
        <button onClick={() => onDiscard(message)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', display: 'flex', padding: 2 }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Pastoral note */}
      {message.pastoral_note && (
        <div style={{ fontSize: 11, color: '#fbbf24', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 8, padding: '7px 10px', marginBottom: 10, lineHeight: 1.5 }}>
          📋 {message.pastoral_note}
        </div>
      )}

      {/* Body */}
      {editing ? (
        <textarea
          ref={textareaRef}
          value={editedBody}
          onChange={e => setEditedBody(e.target.value)}
          rows={3}
          className="w-full outline-none resize-none"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 10, color: 'rgba(255,255,255,0.9)', fontSize: 13, padding: '10px 12px', lineHeight: 1.6, marginBottom: 10 }}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') approve()
            if (e.key === 'Escape') { setEditing(false); setEditedBody(message.body) }
          }}
        />
      ) : (
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.88)', lineHeight: 1.6, marginBottom: 12 }}>{message.body}</p>
      )}

      {/* Tone pills */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginRight: 2 }}>Tone:</span>
        {TONES.map(t => (
          <button key={t} onClick={() => regen(t.toLowerCase())} disabled={regenerating || sending}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: 'none', cursor: regenerating ? 'not-allowed' : 'pointer', fontWeight: activeTone === t.toLowerCase() ? 600 : 400, background: activeTone === t.toLowerCase() ? 'rgba(129,140,248,0.25)' : 'rgba(255,255,255,0.06)', color: activeTone === t.toLowerCase() ? '#818cf8' : 'rgba(255,255,255,0.45)', transition: 'all 0.15s' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button onClick={approve} disabled={sending || regenerating}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, background: sending ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #818cf8)', border: 'none', color: '#fff', cursor: sending ? 'not-allowed' : 'pointer', boxShadow: sending ? 'none' : '0 0 12px rgba(99,102,241,0.3)', transition: 'all 0.15s' }}>
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {editing ? 'Send Edited' : 'Send'}
        </button>

        {editing ? (
          <button onClick={() => { setEditing(false); setEditedBody(message.body) }}
            style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: '7px 10px' }}>
            Cancel
          </button>
        ) : (
          <button onClick={startEdit}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, fontSize: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
            <Edit3 className="w-3.5 h-3.5" />Edit
          </button>
        )}

        <button onClick={() => regen()} disabled={regenerating || sending}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, fontSize: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: regenerating ? 'not-allowed' : 'pointer' }}
          title="Regenerate">
          {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Retry
        </button>

        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>⌘↵ send</span>
      </div>
    </div>
  )
}

function GeneratingSkeleton() {
  return (
    <div style={{ margin: '6px 0 4px', padding: '14px 16px', borderRadius: 16, border: '1px solid rgba(129,140,248,0.15)', background: 'rgba(99,102,241,0.03)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 className="w-2.5 h-2.5 animate-spin" style={{ color: '#818cf8' }} />
        </div>
        <span style={{ fontSize: 11, color: 'rgba(129,140,248,0.6)', fontWeight: 600 }}>Generating AI response...</span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="animate-pulse" style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.07)', width: '80%' }} />
        <div className="animate-pulse" style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.05)', width: '55%' }} />
      </div>
    </div>
  )
}

// ─── Thread Detail ────────────────────────────────────────────────────────────

function ThreadDetail({ conv, onBack }: { conv: Conversation; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const [generatingDraft, setGeneratingDraft] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Separate sent/inbound messages from pending AI draft
  const threadMessages = messages.filter(m => m.direction === 'inbound' || m.approved)
  const pendingDraft = messages.find(m => m.direction === 'outbound' && !m.approved && m.ai_generated) ?? null

  async function loadMessages() {
    try {
      const res = await fetch(`/api/messaging/conversations/${conv.id}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages ?? [])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMessages()

    const channel = sb
      .channel(`messages-${conv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sms_messages', filter: `conversation_id=eq.${conv.id}` }, payload => {
        const msg = payload.new as Message
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        if (msg.direction === 'inbound') setGeneratingDraft(true)
        else if (!msg.approved) setGeneratingDraft(false)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sms_messages', filter: `conversation_id=eq.${conv.id}` }, payload => {
        setMessages(prev => prev.map(m => m.id === (payload.new as Message).id ? payload.new as Message : m))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'sms_messages' }, payload => {
        setMessages(prev => prev.filter(m => m.id !== (payload.old as { id: string }).id))
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [conv.id])

  // Auto-clear generating state if AI never arrives (network/AI failure)
  useEffect(() => {
    if (!generatingDraft) return
    const t = setTimeout(() => setGeneratingDraft(false), 30_000)
    return () => clearTimeout(t)
  }, [generatingDraft])

  // ⌘↵ to send the pending draft
  useEffect(() => {
    if (!pendingDraft) return
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') approveDraft(pendingDraft!)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingDraft])

  async function approveDraft(draft: Message, editedBody?: string) {
    await fetch(`/api/messaging/messages/${draft.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: editedBody }),
    })
    // Realtime UPDATE will flip approved→true, moving it into threadMessages
  }

  async function discardDraft(draft: Message) {
    setMessages(prev => prev.filter(m => m.id !== draft.id))
    await fetch(`/api/messaging/messages/${draft.id}`, { method: 'DELETE' })
  }

  async function regenerateDraft(draft: Message, tone?: string) {
    setMessages(prev => prev.filter(m => m.id !== draft.id))
    setGeneratingDraft(true)
    await fetch(`/api/messaging/conversations/${conv.id}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: draft.id, tone }),
    })
    // New draft arrives via Realtime INSERT → setGeneratingDraft(false)
  }

  async function sendManualReply() {
    if (!replyBody.trim()) return
    setSending(true)
    try {
      await fetch(`/api/messaging/conversations/${conv.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyBody }),
      })
      setReplyBody('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 600 }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}><ArrowLeft className="w-5 h-5" /></button>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: conv.is_sensitive ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {conv.name?.charAt(0) ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>{conv.name}</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{conv.phone}</p>
        </div>
        {conv.is_sensitive && (
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', flexShrink: 0 }}>Sensitive</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: '#818cf8' }} /></div>
        ) : threadMessages.length === 0 && !generatingDraft && !pendingDraft ? (
          <div className="flex-1 flex items-center justify-center">
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No messages yet</p>
          </div>
        ) : (
          <>
            {threadMessages.map(m => (
              <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                <div style={{ maxWidth: '72%', padding: '10px 14px', borderRadius: m.direction === 'outbound' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: m.direction === 'outbound' ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(255,255,255,0.07)', color: m.direction === 'outbound' ? '#fff' : 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1.5, boxShadow: m.direction === 'outbound' ? '0 2px 12px rgba(99,102,241,0.3)' : 'none' }}>
                  {m.body}
                  {m.ai_generated && m.approved && (
                    <span style={{ display: 'block', fontSize: 10, opacity: 0.55, marginTop: 3 }}>AI-assisted</span>
                  )}
                  <span style={{ display: 'block', fontSize: 10, opacity: 0.4, marginTop: 2 }}>
                    {new Date(m.sent_at ?? m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {generatingDraft && !pendingDraft && <GeneratingSkeleton />}
            {pendingDraft && (
              <AIDraftCard
                message={pendingDraft}
                conversationId={conv.id}
                onApprove={approveDraft}
                onDiscard={discardDraft}
                onRegenerate={regenerateDraft}
              />
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply bar — manual replies only */}
      <div className="p-4 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <input
          value={replyBody}
          onChange={e => setReplyBody(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendManualReply()}
          placeholder={pendingDraft ? 'Or type a manual reply...' : 'Type a reply...'}
          className="flex-1 text-sm outline-none"
          style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.85)' }}
        />
        <button onClick={sendManualReply} disabled={sending || !replyBody.trim()} style={{ width: 40, height: 40, borderRadius: 10, background: replyBody.trim() ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', cursor: replyBody.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: replyBody.trim() ? '0 0 14px rgba(99,102,241,0.35)' : 'none' }}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

// ─── Conversations Tab ────────────────────────────────────────────────────────

function ConversationsTab() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)

  async function loadConversations() {
    try {
      const res = await fetch('/api/messaging/conversations')
      if (res.ok) setConversations(await res.json())
    } catch (e) {
      console.error('[conversations]', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConversations()

    // Realtime: any conversation insert or update refreshes the list
    const channel = sb
      .channel('conversations-list')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
      }, () => loadConversations())
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [])

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase()
    return c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
  })

  if (selected) {
    return (
      <GlassCard style={{ overflow: 'hidden' }}>
        <ThreadDetail conv={selected} onBack={() => { setSelected(null); loadConversations() }} />
      </GlassCard>
    )
  }

  return (
    <div>
      {showNew && (
        <NewMessageModal
          onClose={() => setShowNew(false)}
          onSent={() => { setShowNew(false); loadConversations() }}
        />
      )}

      <div className="flex gap-3 mb-4">
        <div className="flex-1 flex items-center gap-2" style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10 }}>
          <Search className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..." className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'rgba(255,255,255,0.8)' }} />
        </div>
        <button onClick={() => setShowNew(true)} style={{ padding: '0 14px', height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #818cf8)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
          <Plus className="w-4 h-4" />New
        </button>
        <button onClick={loadConversations} style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#818cf8' }} /></div>
      ) : filtered.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <MessageSquare className="w-8 h-8 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No conversations yet</p>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 4 }}>
            Configure your Clearstream webhook URL to start receiving texts
          </p>
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: c.is_sensitive ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {c.name?.charAt(0) ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>{c.name}</span>
                  {c.is_sensitive && <AlertTriangle className="w-3 h-3" style={{ color: '#fbbf24', flexShrink: 0 }} />}
                </div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{c.phone}</p>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                {c.last_message_at && (
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                    {new Date(c.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Campaigns Tab ────────────────────────────────────────────────────────────

function CommandBar({ onPreview }: { onPreview: (p: CampaignPreview) => void }) {
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const suggestions = [
    'Text everyone who missed last Sunday',
    'Follow up with new visitors from this month',
    'Check in with people absent 3+ weeks',
    'Send encouragement to youth group members',
  ]

  async function run() {
    if (!command.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/messaging/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Command failed')
      onPreview(data)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }

  return (
    <GlassCard className="p-5 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(99,102,241,0.4)' }}><Zap className="w-4 h-4 text-white" /></div>
        <div>
          <p className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>AI Outreach Command</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Describe who to reach and what to say</p>
        </div>
      </div>
      <div className="flex gap-3">
        <input value={command} onChange={e => setCommand(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="e.g. Text everyone who missed last Sunday..." className="flex-1 text-sm outline-none bg-transparent" style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.85)' }} />
        <button onClick={run} disabled={loading || !command.trim()} style={{ padding: '10px 18px', background: command.trim() ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, color: command.trim() ? '#fff' : 'rgba(255,255,255,0.3)', cursor: command.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, transition: 'all 0.2s' }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}Generate
        </button>
      </div>
      {error && <p className="mt-3 text-xs" style={{ color: '#f87171' }}>{error}</p>}
      <div className="flex flex-wrap gap-2 mt-3">
        {suggestions.map(s => (
          <button key={s} onClick={() => setCommand(s)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', color: 'rgba(129,140,248,0.85)', cursor: 'pointer' }}>{s}</button>
        ))}
      </div>
    </GlassCard>
  )
}

function CampaignPreviewPanel({ preview, onSave, onDiscard }: { preview: CampaignPreview; onSave: () => void; onDiscard: () => void }) {
  const [recipients, setRecipients] = useState(preview.recipients)
  const [saving, setSaving] = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editVal, setEditVal] = useState('')

  async function handleSave() {
    setSaving(true)
    try {
      await fetch('/api/messaging/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: preview.campaignName, command: preview.insight, messageTemplate: preview.messageTemplate, recipients }) })
      onSave()
    } finally { setSaving(false) }
  }

  return (
    <GlassCard className="mb-6">
      <div className="p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1" style={{ color: 'rgba(255,255,255,0.9)' }}>{preview.campaignName}</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{preview.insight}</p>
          </div>
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(129,140,248,0.15)', color: '#818cf8', flexShrink: 0 }}>{recipients.length} recipients</span>
        </div>
        <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.15)', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
          <span style={{ color: '#818cf8', fontWeight: 600 }}>Template: </span>{preview.messageTemplate}
        </div>
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {recipients.map((rec, idx) => (
          <div key={rec.attendee_id} className="p-4 flex items-start gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{rec.name.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{rec.name}</span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{rec.phone}</span>
              </div>
              {editingIdx === idx ? (
                <div className="flex gap-2">
                  <textarea value={editVal} onChange={e => setEditVal(e.target.value)} rows={2} className="flex-1 text-xs outline-none resize-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 8, padding: '6px 8px', color: 'rgba(255,255,255,0.8)' }} />
                  <div className="flex flex-col gap-1">
                    <button onClick={() => { setRecipients(r => r.map((x, i) => i === idx ? { ...x, generated_message: editVal } : x)); setEditingIdx(null) }} style={{ color: '#34d399', cursor: 'pointer', background: 'none', border: 'none' }}><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingIdx(null)} style={{ color: '#94a3b8', cursor: 'pointer', background: 'none', border: 'none' }}><X className="w-4 h-4" /></button>
                  </div>
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{rec.generated_message}</p>
              )}
            </div>
            {editingIdx !== idx && (
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => { setEditingIdx(idx); setEditVal(rec.generated_message) }} style={{ color: '#94a3b8', cursor: 'pointer', background: 'none', border: 'none', padding: 2 }}><Edit3 className="w-3.5 h-3.5" /></button>
                <button onClick={() => setRecipients(r => r.filter((_, i) => i !== idx))} style={{ color: '#f87171', cursor: 'pointer', background: 'none', border: 'none', padding: 2 }}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="p-4 flex justify-end gap-3">
        <button onClick={onDiscard} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>Discard</button>
        <button onClick={handleSave} disabled={saving || recipients.length === 0} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #6366f1, #818cf8)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Save Campaign
        </button>
      </div>
    </GlassCard>
  )
}

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<CampaignPreview | null>(null)
  const [sending, setSending] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/messaging/campaigns')
      if (res.ok) setCampaigns(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function launch(id: string) {
    setSending(id)
    try { await fetch(`/api/messaging/campaigns/${id}/send`, { method: 'POST' }); await load() }
    finally { setSending(null) }
  }

  return (
    <div>
      <CommandBar onPreview={setPreview} />
      {preview && <CampaignPreviewPanel preview={preview} onSave={() => { setPreview(null); load() }} onDiscard={() => setPreview(null)} />}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#818cf8' }} /></div>
      ) : campaigns.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No campaigns yet</p>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 4 }}>Use the AI command bar above to create your first outreach</p>
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-3">
          {campaigns.map(c => (
            <GlassCard key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>{c.name}</span>
                    <CampaignStatusBadge status={c.status} />
                  </div>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{c.command}</p>
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.35)' }} /><span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{c.total_recipients} recipients</span></div>
                {c.status === 'sent' && <div className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" style={{ color: '#34d399' }} /><span style={{ fontSize: 12, color: 'rgba(52,211,153,0.8)' }}>{c.sent_count} sent</span></div>}
                {(c.status === 'draft' || c.status === 'approved') && (
                  <button onClick={() => launch(c.id)} disabled={sending === c.id} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'linear-gradient(135deg, #6366f1, #818cf8)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {sending === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}Launch
                  </button>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'conversations' | 'campaigns'

export default function MessagingPage() {
  const [tab, setTab] = useState<Tab>('conversations')
  const tabs = [
    { id: 'conversations' as Tab, label: 'Conversations', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'campaigns' as Tab, label: 'Campaigns', icon: <Sparkles className="w-4 h-4" /> },
  ]

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8 flex items-center gap-3">
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}>
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.92)' }}>Follow-Up Center</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>AI-powered outreach & conversation management</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, display: 'inline-flex' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', background: tab === t.id ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(129,140,248,0.2))' : 'transparent', color: tab === t.id ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)', transition: 'all 0.15s' }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'conversations' && <ConversationsTab />}
      {tab === 'campaigns' && <CampaignsTab />}
    </div>
  )
}

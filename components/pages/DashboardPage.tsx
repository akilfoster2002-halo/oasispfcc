'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Send, Sparkles, Bot, User, Plus, MessageSquare, Trash2, Menu } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import ReactMarkdown from 'react-markdown'

const supabase = getSupabaseBrowser()

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatSession {
  id: string
  title: string
  created_at: string
  updated_at: string
}

const SUGGESTIONS = [
  'How many people attend on Sundays?',
  'Who are the top midweek attendees?',
  'Which cells are most active?',
  'Show attendance trends this year',
]

function groupSessions(sessions: ChatSession[]) {
  const now = new Date()
  const today = now.toDateString()
  const yesterday = new Date(now.getTime() - 86400000).toDateString()
  const weekAgo = new Date(now.getTime() - 7 * 86400000)

  const groups: { label: string; items: ChatSession[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This Week', items: [] },
    { label: 'Earlier', items: [] },
  ]

  for (const s of sessions) {
    const d = new Date(s.updated_at)
    if (d.toDateString() === today)          groups[0].items.push(s)
    else if (d.toDateString() === yesterday) groups[1].items.push(s)
    else if (d >= weekAgo)                   groups[2].items.push(s)
    else                                     groups[3].items.push(s)
  }

  return groups.filter(g => g.items.length > 0)
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  if (isUser) {
    return (
      <div className="flex justify-end gap-2.5 fade-up">
        <div
          className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-tr-sm leading-relaxed"
          style={{
            background: 'var(--aq-gold)',
            color: 'rgba(6,7,14,0.95)',
            fontSize: '1.05rem',
            letterSpacing: '0.01em',
          }}
        >
          {message.content}
        </div>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{
            background: 'rgba(200,169,107,0.25)',
            border: '0.5px solid var(--aq-border)',
          }}
        >
          <User className="w-3.5 h-3.5" style={{ color: 'var(--aq-gold)' }} />
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-2.5 fade-up">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{
          background: 'rgba(127,168,135,0.20)',
          border: '0.5px solid var(--aq-border)',
        }}
      >
        <Bot className="w-3.5 h-3.5" style={{ color: 'var(--aq-sage)' }} />
      </div>
      <div
        className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tl-sm leading-relaxed"
        style={{
          background: 'var(--aq-elevated)',
          border: '0.5px solid var(--aq-border)',
          color: 'var(--aq-text-primary)',
          fontSize: '1.05rem',
          letterSpacing: '0.01em',
        }}
      >
        <ReactMarkdown
          components={{
            p:      ({ children }) => <p style={{ margin: '0 0 0.5em', lineHeight: '1.7' }}>{children}</p>,
            strong: ({ children }) => <strong style={{ color: '#f0e6c8', fontWeight: 500 }}>{children}</strong>,
            em:     ({ children }) => <em style={{ color: 'var(--aq-text-secondary)' }}>{children}</em>,
            ul:     ({ children }) => <ul style={{ margin: '0.4em 0', paddingLeft: '1.25em', listStyleType: 'disc' }}>{children}</ul>,
            ol:     ({ children }) => <ol style={{ margin: '0.4em 0', paddingLeft: '1.25em' }}>{children}</ol>,
            li:     ({ children }) => <li style={{ marginBottom: '0.2em' }}>{children}</li>,
            h1:     ({ children }) => <p style={{ fontWeight: 500, fontSize: '1.05em', marginBottom: '0.35em', color: '#f0e6c8' }}>{children}</p>,
            h2:     ({ children }) => <p style={{ fontWeight: 500, fontSize: '1em', marginBottom: '0.3em', color: '#e8ddb5' }}>{children}</p>,
            h3:     ({ children }) => <p style={{ fontWeight: 500, marginBottom: '0.25em', color: '#e8ddb5' }}>{children}</p>,
            code:   ({ children }) => (
              <code style={{ background: 'var(--aq-elevated)', padding: '1px 5px', borderRadius: '4px', fontSize: '0.85em', fontFamily: 'monospace' }}>
                {children}
              </code>
            ),
            hr: () => <hr style={{ border: 'none', borderTop: '0.5px solid var(--aq-border)', margin: '0.5em 0' }} />,
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: 'rgba(127,168,135,0.20)',
          border: '0.5px solid var(--aq-border)',
        }}
      >
        <Bot className="w-3.5 h-3.5" style={{ color: 'var(--aq-sage)' }} />
      </div>
      <div
        className="px-4 py-3 rounded-2xl rounded-tl-sm"
        style={{
          background: 'var(--aq-elevated)',
          border: '0.5px solid var(--aq-border)',
        }}
      >
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ backgroundColor: 'rgba(200,169,107,0.60)', animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const params = useParams()
  const slug = (params?.slug as string) ?? ''
  const [sessions, setSessions]               = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages]               = useState<Message[]>([])
  const [input, setInput]                     = useState('')
  const [loading, setLoading]                 = useState(false)
  const [loadingMsgs, setLoadingMsgs]         = useState(false)
  const [showDrawer, setShowDrawer]           = useState(false)
  const [firstName, setFirstName]             = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null
      const meta = data.user?.user_metadata
      const name = (meta?.full_name ?? meta?.name ?? '') as string
      setFirstName(name.split(' ')[0] || null)
    })
  }, [])

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(60)
    if (data) setSessions(data as ChatSession[])
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return }
    setLoadingMsgs(true)
    supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', activeSessionId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages((data ?? []) as Message[])
        setLoadingMsgs(false)
      })
  }, [activeSessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const newChat = () => {
    setActiveSessionId(null)
    setMessages([])
    setInput('')
    setShowDrawer(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const selectSession = (id: string) => {
    setActiveSessionId(id)
    setShowDrawer(false)
  }

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await supabase.from('chat_sessions').delete().eq('id', id)
    if (activeSessionId === id) { setActiveSessionId(null); setMessages([]) }
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text.trim() }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)
    if (inputRef.current) { inputRef.current.style.height = 'auto' }

    let sessionId = activeSessionId

    if (!sessionId) {
      const title = text.trim().slice(0, 70)
      const userId = userIdRef.current ?? (await supabase.auth.getUser()).data.user?.id
      const { data } = await supabase
        .from('chat_sessions')
        .insert({ title, user_id: userId })
        .select('id')
        .single()
      if (data) {
        sessionId = data.id
        setActiveSessionId(sessionId)
        const newSession: ChatSession = {
          id: data.id, title,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setSessions(prev => [newSession, ...prev])
      }
    }

    if (sessionId) {
      await supabase.from('chat_messages').insert({ session_id: sessionId, role: 'user', content: text.trim() })
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      })
      const rawText = await res.text()
      let data: { reply?: string; error?: string; limit?: number; used?: number; resetAt?: string }
      try {
        data = JSON.parse(rawText)
      } catch {
        console.error('[chat] non-JSON response:', res.status, rawText.slice(0, 200))
        throw new Error(`Server returned ${res.status}: ${rawText.slice(0, 80)}`)
      }
      let reply: string
      if (data.error === 'daily_limit_reached') {
        reply = `You've used all ${data.limit} messages for today. Your limit resets at midnight. Upgrade your plan for unlimited access → /${slug}/pricing`
      } else {
        reply = data.error ? `Sorry, something went wrong: ${data.error}` : (data.reply ?? 'No response.')
      }
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])

      if (sessionId) {
        await supabase.from('chat_messages').insert({ session_id: sessionId, role: 'assistant', content: reply })
        await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId)
        loadSessions()
      }
    } catch (err) {
      console.error('[chat] fetch error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  const sessionGroups = groupSessions(sessions)

  const SessionList = (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2 shrink-0">
        <button
          onClick={newChat}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
          style={{
            background: 'rgba(200,169,107,0.18)',
            border: '0.5px solid var(--aq-border)',
            color: 'var(--aq-gold)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(200,169,107,0.28)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(200,169,107,0.18)' }}
        >
          <Plus className="w-4 h-4 shrink-0" />
          New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {sessionGroups.length === 0 ? (
          <p className="text-xs text-center mt-8 px-3" style={{ color: 'var(--aq-text-muted)' }}>
            No conversations yet
          </p>
        ) : sessionGroups.map(group => (
          <div key={group.label} className="mb-3">
            <p
              className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em]"
              style={{ color: 'var(--aq-text-tertiary)' }}
            >
              {group.label}
            </p>
            {group.items.map(s => (
              <div
                key={s.id}
                onClick={() => selectSession(s.id)}
                className="flex items-center gap-2 px-2 py-2 rounded-xl cursor-pointer group transition-all duration-150"
                style={{
                  background: activeSessionId === s.id
                    ? 'rgba(200,169,107,0.14)'
                    : 'transparent',
                  border: activeSessionId === s.id ? '0.5px solid var(--aq-border)' : '0.5px solid transparent',
                  color: activeSessionId === s.id ? 'var(--aq-gold)' : 'var(--aq-text-secondary)',
                }}
                onMouseEnter={e => {
                  if (activeSessionId !== s.id) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--aq-surface)'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--aq-text-primary)'
                  }
                }}
                onMouseLeave={e => {
                  if (activeSessionId !== s.id) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--aq-text-secondary)'
                  }
                }}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
                <span className="flex-1 truncate text-xs font-medium">{s.title}</span>
                <button
                  onClick={(e) => deleteSession(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" style={{ color: 'var(--aq-rose)' }} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )

  const isEmpty = messages.length === 0 && !loadingMsgs

  return (
    <div className="flex h-[calc(100dvh-4rem)] md:h-screen" style={{ background: 'transparent' }}>

      {/* Desktop sessions panel */}
      <div
        className="hidden md:flex flex-col w-52 shrink-0"
        style={{ borderRight: '0.5px solid var(--aq-border)', background: 'var(--aq-surface)' }}
      >
        {SessionList}
      </div>

      {/* Mobile drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowDrawer(false)} />
          <div
            className="absolute left-0 top-0 bottom-0 w-64 z-10 flex flex-col"
            style={{
              background: 'var(--aq-base)',
              borderRight: '0.5px solid var(--aq-border)',
            }}
          >
            <div
              className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0"
              style={{ borderBottom: '0.5px solid var(--aq-border)' }}
            >
              <span className="text-xs font-medium" style={{ color: 'var(--aq-text-secondary)' }}>
                Chat History
              </span>
              <button
                onClick={() => setShowDrawer(false)}
                className="text-xs px-2 py-1 rounded-lg"
                style={{ color: 'var(--aq-text-tertiary)', background: 'var(--aq-surface)' }}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{SessionList}</div>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Header */}
        <div
          className="shrink-0 px-4 py-3 flex items-center gap-3"
          style={{
            background: 'var(--aq-surface)',
            borderBottom: '0.5px solid var(--aq-border)',
          }}
        >
          <button
            className="md:hidden p-1.5 rounded-xl transition-colors"
            style={{ background: 'var(--aq-surface)', border: '0.5px solid var(--aq-border)' }}
            onClick={() => setShowDrawer(true)}
            title="Chat history"
          >
            <Menu className="w-4 h-4" style={{ color: 'var(--aq-text-secondary)' }} />
          </button>
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(127,168,135,0.25)',
              border: '0.5px solid var(--aq-border)',
            }}
          >
            <Sparkles className="w-4 h-4" style={{ color: 'var(--aq-sage)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-medium" style={{ color: 'var(--aq-text-primary)' }}>
              Aquila Agent
            </h1>
            <p className="text-xs truncate" style={{ color: 'var(--aq-text-tertiary)' }}>
              {activeSessionId
                ? (sessions.find(s => s.id === activeSessionId)?.title ?? 'Chat')
                : 'Ask anything about your congregation'}
            </p>
          </div>
          <button
            onClick={newChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200"
            style={{
              background: 'var(--aq-surface)',
              border: '0.5px solid var(--aq-border)',
              color: 'var(--aq-text-secondary)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--aq-elevated)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--aq-surface)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {loadingMsgs ? (
            <div className="flex justify-center pt-20">
              <div className="flex gap-1.5 items-center">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="rounded-full animate-bounce"
                    style={{
                      width: 5, height: 5,
                      backgroundColor: 'rgba(200,169,107,0.50)',
                      animationDelay: `${i * 0.14}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-center" style={{ paddingBottom: 80, gap: 0 }}>

              {/* Atmospheric icon */}
              <div style={{ position: 'relative', width: 88, height: 88, marginBottom: 28 }}>
                {/* Outermost ambient ring */}
                <div style={{
                  position: 'absolute', inset: -16,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(127,168,135,0.08) 0%, transparent 70%)',
                }} />
                {/* Outer ring */}
                <div style={{
                  position: 'absolute', inset: 0,
                  borderRadius: '50%',
                  border: '0.5px solid var(--aq-border)',
                }} />
                {/* Icon container */}
                <div style={{
                  position: 'absolute', inset: 8,
                  borderRadius: '50%',
                  background: 'var(--aq-elevated)',
                  border: '0.5px solid var(--aq-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Sparkles style={{ width: 28, height: 28, color: 'var(--aq-sage)' }} />
                </div>
              </div>

              {/* Headline — Space Grotesk */}
              <h2 className="text-display" style={{ marginBottom: 10 }}>
                {firstName ? `Good to see you, ${firstName}.` : 'See your church clearly.'}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--aq-text-tertiary)', maxWidth: 300, lineHeight: 1.6, marginBottom: 36 }}>
                Ask anything about your congregation — members, attendance, cells, or trends.
              </p>

              {/* Suggestion cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 8,
                width: '100%',
                maxWidth: 380,
              }}>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    style={{
                      padding: '12px 14px',
                      textAlign: 'left',
                      borderRadius: 14,
                      background: 'var(--aq-surface)',
                      border: '0.5px solid var(--aq-border)',
                      color: 'var(--aq-text-secondary)',
                      fontSize: 12,
                      lineHeight: 1.45,
                      cursor: 'pointer',
                      transition: 'color 0.14s ease, background 0.14s ease, border-color 0.14s ease, transform 0.14s ease',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.color = 'var(--aq-text-primary)'
                      el.style.background = 'var(--aq-elevated)'
                      el.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.color = 'var(--aq-text-secondary)'
                      el.style.background = 'var(--aq-surface)'
                      el.style.transform = 'none'
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => <MessageBubble key={i} message={m} />)
          )}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          className="shrink-0 px-4 py-3"
          style={{
            background: 'var(--aq-surface)',
            borderTop: '0.5px solid var(--aq-border)',
          }}
        >
          <div
            className="flex items-end gap-3 rounded-2xl px-4 py-3 transition-all duration-200"
            style={{
              background: 'var(--aq-elevated)',
              border: '0.5px solid var(--aq-border)',
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your congregation…"
              className="flex-1 resize-none bg-transparent text-sm outline-none leading-relaxed"
              style={{ color: 'var(--aq-text-primary)', maxHeight: '120px' }}
              disabled={loading}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-30"
              style={{
                background: 'var(--aq-gold)',
              }}
            >
              <Send className="w-3.5 h-3.5" style={{ color: 'rgba(6,7,14,0.90)' }} />
            </button>
          </div>
          <p className="text-center text-[10px] mt-2" style={{ color: 'var(--aq-text-muted)' }}>
            Shift + Enter for new line · Enter to send
          </p>
        </div>
      </div>
    </div>
  )
}

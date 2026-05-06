'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Send, Sparkles, Bot, User, Plus, MessageSquare, Trash2, Menu } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
  'How many people are in the church?',
  'Who are the top midweek attendees?',
  'Which cells are most active?',
  'How many people have been baptized?',
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
    if (d.toDateString() === today)     groups[0].items.push(s)
    else if (d.toDateString() === yesterday) groups[1].items.push(s)
    else if (d >= weekAgo)              groups[2].items.push(s)
    else                                groups[3].items.push(s)
  }

  return groups.filter(g => g.items.length > 0)
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  if (isUser) {
    return (
      <div className="flex justify-end gap-2.5">
        <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed text-white"
          style={{ backgroundColor: '#4068E2' }}>
          {message.content}
        </div>
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: '#E0E7FF' }}>
          <User className="w-3.5 h-3.5" style={{ color: '#4068E2' }} />
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-2.5">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: '#1C2333' }}>
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed whitespace-pre-wrap"
        style={{ backgroundColor: '#FFFFFF', color: '#111827', border: '1px solid #E5E7EB' }}>
        {message.content}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: '#1C2333' }}>
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm"
        style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}>
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ backgroundColor: '#9CA3AF', animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [sessions, setSessions]               = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages]               = useState<Message[]>([])
  const [input, setInput]                     = useState('')
  const [loading, setLoading]                 = useState(false)
  const [loadingMsgs, setLoadingMsgs]         = useState(false)
  const [showDrawer, setShowDrawer]           = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

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
      const { data } = await supabase
        .from('chat_sessions')
        .insert({ title })
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
      const data = await res.json()
      const reply = data.error ? `Sorry, something went wrong: ${data.error}` : data.reply
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])

      if (sessionId) {
        await supabase.from('chat_messages').insert({ session_id: sessionId, role: 'assistant', content: reply })
        await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId)
        loadSessions()
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't connect. Please try again." }])
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
    <div className="flex flex-col h-full" style={{ backgroundColor: '#F8F9FA' }}>
      <div className="px-3 pt-3 pb-2 shrink-0">
        <button
          onClick={newChat}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium"
          style={{ backgroundColor: '#4068E2', color: '#FFFFFF' }}
        >
          <Plus className="w-4 h-4 shrink-0" />
          New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {sessionGroups.length === 0 ? (
          <p className="text-xs text-center mt-8 px-3" style={{ color: '#9CA3AF' }}>
            No conversations yet
          </p>
        ) : sessionGroups.map(group => (
          <div key={group.label} className="mb-3">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: '#9CA3AF' }}>
              {group.label}
            </p>
            {group.items.map(s => (
              <div
                key={s.id}
                onClick={() => selectSession(s.id)}
                className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer group"
                style={{
                  backgroundColor: activeSessionId === s.id ? 'rgba(64,104,226,0.1)' : 'transparent',
                  color: activeSessionId === s.id ? '#4068E2' : '#374151',
                }}
                onMouseEnter={e => { if (activeSessionId !== s.id) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)' }}
                onMouseLeave={e => { if (activeSessionId !== s.id) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
                <span className="flex-1 truncate text-xs font-medium">{s.title}</span>
                <button
                  onClick={(e) => deleteSession(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" style={{ color: '#EF4444' }} />
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
    <div className="flex h-[calc(100dvh-4rem)] md:h-screen" style={{ backgroundColor: '#F0F2F5' }}>

      {/* Desktop sessions panel */}
      <div className="hidden md:flex flex-col w-52 shrink-0" style={{ borderRight: '1px solid #E5E7EB' }}>
        {SessionList}
      </div>

      {/* Mobile drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDrawer(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 shadow-2xl z-10">
            <div className="flex items-center justify-between px-4 pt-3 pb-1 border-b"
              style={{ backgroundColor: '#F8F9FA', borderColor: '#E5E7EB' }}>
              <span className="text-xs font-semibold" style={{ color: '#374151' }}>Chat History</span>
              <button onClick={() => setShowDrawer(false)} className="text-xs px-2 py-1 rounded"
                style={{ color: '#6B7280' }}>
                Close
              </button>
            </div>
            <div className="h-[calc(100%-44px)]">
              {SessionList}
            </div>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Header */}
        <div className="shrink-0 px-4 py-3 flex items-center gap-3"
          style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E7EB' }}>
          <button
            className="md:hidden p-1.5 rounded-lg"
            style={{ backgroundColor: '#F3F4F6' }}
            onClick={() => setShowDrawer(true)}
            title="Chat history"
          >
            <Menu className="w-4 h-4" style={{ color: '#374151' }} />
          </button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#1C2333' }}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold" style={{ color: '#111827' }}>Oasis Assistant</h1>
            <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>
              {activeSessionId
                ? (sessions.find(s => s.id === activeSessionId)?.title ?? 'Chat')
                : 'Ask anything about your congregation'}
            </p>
          </div>
          <button
            onClick={newChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: '#F3F4F6', color: '#374151' }}
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {loadingMsgs ? (
            <div className="flex justify-center pt-16">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-2 h-2 rounded-full animate-bounce"
                    style={{ backgroundColor: '#CBD5E1', animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-center pb-16 space-y-8">
              <div>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: '#1C2333' }}>
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-xl font-semibold mb-1.5" style={{ color: '#111827' }}>
                  How can I help?
                </h2>
                <p className="text-sm max-w-xs mx-auto" style={{ color: '#6B7280' }}>
                  Ask about members, attendance, cells, groups, or any individual.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="px-4 py-2.5 text-sm text-left rounded-xl transition-colors hover:bg-white"
                    style={{ border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#FFFFFF' }}
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
        <div className="shrink-0 px-4 py-3"
          style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E5E7EB' }}>
          <div className="flex items-end gap-3 rounded-2xl px-4 py-3"
            style={{ border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
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
              style={{ color: '#111827', maxHeight: '120px' }}
              disabled={loading}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
              style={{ backgroundColor: '#4068E2' }}
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          <p className="text-center text-[10px] mt-2" style={{ color: '#D1D5DB' }}>
            Shift + Enter for new line · Enter to send
          </p>
        </div>
      </div>
    </div>
  )
}

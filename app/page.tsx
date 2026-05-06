'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, Bot, User } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'How many people are in the church?',
  'Show me upcoming events',
  'Which groups have the most members?',
  'What was attendance like last month?',
]

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 group">
        <div
          className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed text-white"
          style={{ backgroundColor: '#4068E2' }}
        >
          {message.content}
        </div>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: '#E0E7FF' }}
        >
          <User className="w-3.5 h-3.5" style={{ color: '#4068E2' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 group">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: '#1C2333' }}
      >
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div
        className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed whitespace-pre-wrap"
        style={{
          backgroundColor: '#FFFFFF',
          color: '#111827',
          border: '1px solid #E5E7EB',
        }}
      >
        {message.content}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: '#1C2333' }}
      >
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div
        className="px-4 py-3 rounded-2xl rounded-tl-sm"
        style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}
      >
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ backgroundColor: '#9CA3AF', animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMessage: Message = { role: 'user', content: text.trim() }
    const updated = [...messages, userMessage]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      })
      const data = await res.json()
      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong: ${data.error}` }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I couldn\'t connect. Please try again.' }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] md:h-screen" style={{ backgroundColor: '#F0F2F5' }}>

      {/* Header */}
      <div
        className="shrink-0 px-4 md:px-6 py-3.5 flex items-center gap-3"
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: '#1C2333' }}
        >
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold" style={{ color: '#111827' }}>Oasis Assistant</h1>
          <p className="text-xs" style={{ color: '#9CA3AF' }}>Ask anything about your congregation</p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-4">

        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center pb-24 space-y-8">
            <div>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: '#1C2333' }}
              >
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-semibold mb-1.5" style={{ color: '#111827' }}>
                How can I help you today?
              </h2>
              <p className="text-sm max-w-xs mx-auto" style={{ color: '#6B7280' }}>
                Ask me anything about your church — members, attendance, groups, and events.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="px-4 py-2.5 text-sm text-left rounded-xl transition-colors hover:bg-white"
                  style={{
                    border: '1px solid #E5E7EB',
                    color: '#374151',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}

        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="shrink-0 px-4 md:px-6 pb-safe"
        style={{
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          paddingTop: '0.75rem',
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E5E7EB',
        }}
      >
        <div
          className="flex items-end gap-3 rounded-2xl px-4 py-3"
          style={{ border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}
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
  )
}

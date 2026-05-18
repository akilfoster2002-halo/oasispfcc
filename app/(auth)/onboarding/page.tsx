'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Church, Check, X, Loader2 } from 'lucide-react'

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [churchId, setChurchId] = useState('')
  const [idEdited, setIdEdited] = useState(false)
  const [availability, setAvailability] = useState<Availability>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-populate ID from name
  useEffect(() => {
    if (!idEdited && name) {
      setChurchId(toSlug(name))
    }
  }, [name, idEdited])

  // Check availability with debounce
  useEffect(() => {
    if (!churchId || churchId.length < 3) {
      setAvailability(churchId.length > 0 && churchId.length < 3 ? 'invalid' : 'idle')
      return
    }
    if (!/^[a-z0-9-]+$/.test(churchId)) {
      setAvailability('invalid')
      return
    }
    setAvailability('checking')
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/churches/${churchId}/available`)
        const { available } = await res.json()
        setAvailability(available ? 'available' : 'taken')
      } catch {
        setAvailability('idle')
      }
    }, 400)
    return () => clearTimeout(t)
  }, [churchId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (availability !== 'available') return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/churches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug: churchId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create church'); return }
      router.push(`/${churchId}/dashboard`)
    } finally {
      setLoading(false)
    }
  }

  const idStatusIcon = {
    idle:      null,
    checking:  <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'rgba(255,255,255,0.35)' }} />,
    available: <Check className="w-4 h-4" style={{ color: '#34d399' }} />,
    taken:     <X className="w-4 h-4" style={{ color: '#f87171' }} />,
    invalid:   <X className="w-4 h-4" style={{ color: '#f87171' }} />,
  }[availability]

  const idMessage = {
    idle:      '',
    checking:  'Checking…',
    available: 'Available ✓',
    taken:     'Already taken — try another',
    invalid:   'Only lowercase letters, numbers, and hyphens. Min 3 chars.',
  }[availability]

  const idColor = {
    idle:      'rgba(255,255,255,0.28)',
    checking:  'rgba(255,255,255,0.35)',
    available: '#34d399',
    taken:     '#f87171',
    invalid:   '#f87171',
  }[availability]

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(180deg, rgba(8,12,26,1) 0%, rgba(10,14,35,1) 100%)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', boxShadow: '0 0 16px rgba(129,140,248,0.40)' }}
        >
          <Church className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>Church-Link</span>
      </div>

      <div
        className="w-full max-w-sm p-8 rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
          border: '1px solid rgba(255,255,255,0.09)',
        }}
      >
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'rgba(255,255,255,0.92)' }}>
            Set up your church
          </h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
            You'll be the admin. Invite your team next.
          </p>
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.20)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Church name */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Church name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Grace Baptist Church"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.88)',
              }}
            />
          </div>

          {/* Church ID */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Church ID <span style={{ color: 'rgba(255,255,255,0.28)' }}>(your unique URL)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={churchId}
                onChange={e => { setIdEdited(true); setChurchId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')) }}
                placeholder="grace-baptist"
                className="w-full px-4 py-2.5 pr-10 rounded-xl text-sm outline-none"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${availability === 'available' ? 'rgba(52,211,153,0.30)' : availability === 'taken' || availability === 'invalid' ? 'rgba(248,113,113,0.30)' : 'rgba(255,255,255,0.10)'}`,
                  color: 'rgba(255,255,255,0.88)',
                }}
              />
              {idStatusIcon && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">{idStatusIcon}</span>
              )}
            </div>

            {/* Preview URL */}
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                church-link.app/<span style={{ color: 'rgba(255,255,255,0.50)' }}>{churchId || '…'}</span>/dashboard
              </p>
              {idMessage && (
                <p className="text-[11px]" style={{ color: idColor }}>{idMessage}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || availability !== 'available'}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all mt-1"
            style={{
              background: availability === 'available' && !loading
                ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)'
                : 'rgba(255,255,255,0.08)',
              color: availability === 'available' && !loading ? '#fff' : 'rgba(255,255,255,0.28)',
              boxShadow: availability === 'available' && !loading ? '0 4px 16px rgba(99,102,241,0.40)' : 'none',
            }}
          >
            {loading ? 'Creating church…' : 'Create Church & Enter Dashboard'}
          </button>
        </form>
      </div>
    </div>
  )
}

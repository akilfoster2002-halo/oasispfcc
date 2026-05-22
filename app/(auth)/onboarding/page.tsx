'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import {
  Check, X, Loader2, ArrowRight,
  Users, CalendarDays, BarChart3, MessageSquare, FileText, Sparkles, Key,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(name: string) {
  return name
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

// ─── Brand mark ───────────────────────────────────────────────────────────────

function AquilaMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <radialGradient id="ob-bg" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#A88A35"/>
          <stop offset="100%" stopColor="#0C1829"/>
        </radialGradient>
        <radialGradient id="ob-iris" cx="40%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.95"/>
          <stop offset="100%" stopColor="#C9A84C" stopOpacity="0.85"/>
        </radialGradient>
        <filter id="ob-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#ob-bg)"/>
      <rect x="0" y="0" width="32" height="14" rx="9" fill="rgba(255,255,255,0.10)"/>
      <rect x="0" y="7" width="32" height="7" fill="rgba(255,255,255,0)"/>
      <circle cx="16" cy="16" r="7" stroke="rgba(255,255,255,0.20)" strokeWidth="1"/>
      <circle cx="16" cy="16" r="4" fill="url(#ob-iris)" filter="url(#ob-glow)"/>
      <circle cx="13.5" cy="13.5" r="1.2" fill="rgba(255,255,255,0.55)"/>
    </svg>
  )
}

// ─── Shared input styles ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 14,
  fontSize: 15,
  outline: 'none',
  background: 'rgba(255,255,255,0.040)',
  border: '1px solid rgba(255,255,255,0.090)',
  color: 'rgba(255,255,255,0.92)',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  boxSizing: 'border-box',
  letterSpacing: '-0.010em',
}
function fi(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'rgba(201,168,76,0.55)'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.12)'
}
function fo(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.090)'
  e.currentTarget.style.boxShadow = 'none'
}

// ─── Feature list ─────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Users,        label: 'People & attendance tracking' },
  { icon: CalendarDays, label: 'Event calendar with check-in' },
  { icon: FileText,     label: 'Cell report forms' },
  { icon: BarChart3,    label: 'Analytics dashboard' },
  { icon: MessageSquare,label: 'AI-powered messaging' },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()

  const [step, setStep] = useState<'welcome' | 'join' | 'setup' | 'done'>('welcome')

  // Join with key state
  const [accessKey, setAccessKey] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [userName, setUserName] = useState('')

  // Church setup state
  const [name, setName] = useState('')
  const [churchId, setChurchId] = useState('')
  const [idEdited, setIdEdited] = useState(false)
  const [availability, setAvailability] = useState<Availability>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdSlug, setCreatedSlug] = useState('')

  // Grab the user's name for the welcome screen
  useEffect(() => {
    getSupabaseBrowser().auth.getUser().then(({ data }) => {
      const n = data.user?.user_metadata?.full_name ?? data.user?.email ?? ''
      setUserName(n.split(' ')[0])
    })
  }, [])

  // Auto-populate church ID from name
  useEffect(() => {
    if (!idEdited && name) setChurchId(toSlug(name))
  }, [name, idEdited])

  // Live availability check
  useEffect(() => {
    if (!churchId || churchId.length < 3) {
      setAvailability(churchId.length > 0 && churchId.length < 3 ? 'invalid' : 'idle')
      return
    }
    if (!/^[a-z0-9-]+$/.test(churchId)) { setAvailability('invalid'); return }
    setAvailability('checking')
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/churches/${churchId}/available`)
        const { available } = await res.json()
        setAvailability(available ? 'available' : 'taken')
      } catch { setAvailability('idle') }
    }, 350)
    return () => clearTimeout(t)
  }, [churchId])

  async function handleCreate(e: React.FormEvent) {
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
      if (!res.ok) { setError(data.error ?? 'Failed to create workspace'); return }
      setCreatedSlug(churchId)
      setStep('done')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setJoinError('')
    setJoining(true)
    try {
      const res = await fetch('/api/auth/join-with-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: accessKey }),
      })
      const data = await res.json()
      if (!res.ok) { setJoinError(data.error ?? 'Invalid key'); return }
      router.push(`/${data.slug}/dashboard`)
    } finally {
      setJoining(false)
    }
  }

  const idOk = availability === 'available'
  const idBad = availability === 'taken' || availability === 'invalid'

  const wrapStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    background: '#050810',
    backgroundImage: 'radial-gradient(ellipse 70% 55% at 15% 0%, rgba(79,127,196,0.16) 0%, transparent 65%), radial-gradient(ellipse 55% 45% at 85% 100%, rgba(79,127,196,0.10) 0%, transparent 65%)',
    fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)',
    WebkitFontSmoothing: 'antialiased',
  }

  // ── Step: Welcome ──────────────────────────────────────────────────────────
  if (step === 'welcome') {
    return (
      <div style={wrapStyle}>
        <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

          {/* Mark + glow */}
          <div style={{ position: 'relative', marginBottom: 28 }}>
            <AquilaMark size={52} />
            <div style={{ position: 'absolute', inset: -16, borderRadius: 28, background: 'radial-gradient(circle, rgba(201,168,76,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />
          </div>

          {/* Headline */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            {userName && (
              <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.65)', marginBottom: 10 }}>
                Welcome, {userName}
              </p>
            )}
            <h1 style={{
              fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui',
              fontSize: 38, fontWeight: 800, letterSpacing: '-0.030em', lineHeight: 1.10,
              color: 'rgba(255,255,255,0.95)', margin: '0 0 14px',
            }}>
              Your account is ready.
            </h1>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, maxWidth: 340, margin: '0 auto' }}>
              Next, set up your church workspace and start managing your ministry in one place.
            </p>
          </div>

          {/* Feature list */}
          <div style={{
            width: '100%',
            background: 'linear-gradient(145deg, rgba(255,255,255,0.042) 0%, rgba(255,255,255,0.012) 100%)',
            border: '1px solid rgba(255,255,255,0.065)',
            borderRadius: 20,
            padding: '20px 24px',
            marginBottom: 28,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', margin: '0 0 4px' }}>
              Included in your workspace
            </p>
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.18)' }}>
                  <Icon style={{ width: 13, height: 13, color: '#C9A84C' }} />
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 400 }}>{label}</span>
                <Check style={{ width: 13, height: 13, color: '#34d399', marginLeft: 'auto', flexShrink: 0 }} />
              </div>
            ))}
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => setStep('setup')}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '15px 0', borderRadius: 14, fontSize: 16, fontWeight: 700,
                border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #A88A35 0%, #C9A84C 100%)',
                color: '#fff', letterSpacing: '-0.010em',
                boxShadow: '0 6px 24px rgba(201,168,76,0.50)',
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.90')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <Sparkles style={{ width: 16, height: 16 }} />
              Create a church workspace
              <ArrowRight style={{ width: 16, height: 16 }} />
            </button>
            <button
              onClick={() => setStep('join')}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '14px 0', borderRadius: 14, fontSize: 15, fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.65)', letterSpacing: '-0.010em',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)' }}
            >
              <Key style={{ width: 15, height: 15 }} />
              Join with an access key
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step: Join with key ───────────────────────────────────────────────────
  if (step === 'join') {
    return (
      <div style={wrapStyle}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <AquilaMark size={32} />
            <div>
              <p style={{ fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui', fontSize: 15, fontWeight: 700, letterSpacing: '-0.020em', color: 'rgba(255,255,255,0.88)', margin: 0 }}>Aquila</p>
              <p style={{ fontSize: 10, color: 'rgba(201,168,76,0.52)', letterSpacing: '0.08em', fontWeight: 500, margin: 0 }}>BY OASIS PFCC</p>
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em', color: 'rgba(255,255,255,0.94)', margin: '0 0 8px' }}>
              Enter your access key
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.40)', margin: 0 }}>
              Ask your church admin for the current key, then enter it below.
            </p>
          </div>

          {joinError && (
            <div style={{ marginBottom: 20, padding: '10px 16px', borderRadius: 12, fontSize: 13, background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.22)' }}>
              {joinError}
            </div>
          )}

          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'rgba(255,255,255,0.55)' }}>
                Access Key
              </label>
              <input
                type="text"
                required
                autoFocus
                autoComplete="off"
                value={accessKey}
                onChange={e => { setAccessKey(e.target.value.toUpperCase()); setJoinError('') }}
                placeholder="XXXX-XXXX"
                style={{ ...inputStyle, textAlign: 'center', fontSize: 22, fontWeight: 700, letterSpacing: '0.12em', fontFamily: 'monospace' }}
                onFocus={fi}
                onBlur={fo}
              />
            </div>

            <button
              type="submit"
              disabled={joining || !accessKey.trim()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px 0', borderRadius: 14, fontSize: 15, fontWeight: 700,
                border: 'none', cursor: joining || !accessKey.trim() ? 'not-allowed' : 'pointer',
                background: accessKey.trim() && !joining ? 'linear-gradient(135deg, #A88A35 0%, #C9A84C 100%)' : 'rgba(255,255,255,0.06)',
                color: accessKey.trim() && !joining ? '#fff' : 'rgba(255,255,255,0.28)',
                boxShadow: accessKey.trim() && !joining ? '0 4px 20px rgba(201,168,76,0.45)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {joining ? <><Loader2 style={{ width: 15, height: 15, animation: 'spin 0.8s linear infinite' }} /> Joining…</> : <>Join workspace <ArrowRight style={{ width: 15, height: 15 }} /></>}
            </button>

            <button type="button" onClick={() => { setStep('welcome'); setJoinError(''); setAccessKey('') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.30)', padding: 0, transition: 'color 0.12s ease' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.30)')}
            >
              ← Back
            </button>
          </form>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Step: Church setup ────────────────────────────────────────────────────
  if (step === 'setup') {
    return (
      <div style={wrapStyle}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Back + logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <AquilaMark size={32} />
            <div>
              <p style={{ fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui', fontSize: 15, fontWeight: 700, letterSpacing: '-0.020em', color: 'rgba(255,255,255,0.88)', margin: 0 }}>Aquila</p>
              <p style={{ fontSize: 10, color: 'rgba(201,168,76,0.52)', letterSpacing: '0.08em', fontWeight: 500, margin: 0 }}>BY OASIS PFCC</p>
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em', color: 'rgba(255,255,255,0.94)', margin: '0 0 8px' }}>
              Set up your church
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.40)', margin: 0 }}>
              You&apos;ll be the admin. Invite your team from the dashboard.
            </p>
          </div>

          {error && (
            <div style={{ marginBottom: 20, padding: '10px 16px', borderRadius: 12, fontSize: 13, background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.22)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Church name */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'rgba(255,255,255,0.55)' }}>
                Church name
              </label>
              <input
                type="text" required autoFocus
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Oasis PFCC"
                style={inputStyle} onFocus={fi} onBlur={fo}
              />
            </div>

            {/* Church ID */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'rgba(255,255,255,0.55)' }}>
                Workspace ID{' '}
                <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.28)' }}>— your unique URL</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text" required
                  value={churchId}
                  onChange={e => { setIdEdited(true); setChurchId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')) }}
                  placeholder="oasis-pfcc"
                  style={{
                    ...inputStyle,
                    paddingRight: 44,
                    borderColor: idOk ? 'rgba(52,211,153,0.40)' : idBad ? 'rgba(248,113,113,0.40)' : 'rgba(255,255,255,0.090)',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = idOk ? 'rgba(52,211,153,0.55)' : idBad ? 'rgba(248,113,113,0.55)' : 'rgba(201,168,76,0.55)'
                    e.currentTarget.style.boxShadow = idOk ? '0 0 0 3px rgba(52,211,153,0.10)' : idBad ? '0 0 0 3px rgba(248,113,113,0.10)' : '0 0 0 3px rgba(201,168,76,0.12)'
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = idOk ? 'rgba(52,211,153,0.40)' : idBad ? 'rgba(248,113,113,0.40)' : 'rgba(255,255,255,0.090)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
                  {availability === 'checking' && <Loader2 style={{ width: 15, height: 15, color: 'rgba(255,255,255,0.35)', animation: 'spin 0.8s linear infinite' }} />}
                  {availability === 'available' && <Check style={{ width: 15, height: 15, color: '#34d399' }} />}
                  {(availability === 'taken' || availability === 'invalid') && <X style={{ width: 15, height: 15, color: '#f87171' }} />}
                </span>
              </div>

              {/* URL preview + status */}
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', margin: 0 }}>
                  {typeof window !== 'undefined' ? window.location.hostname : 'aquila.app'}/<span style={{ color: churchId ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.22)' }}>{churchId || '…'}</span>/dashboard
                </p>
                <p style={{ fontSize: 12, margin: 0, color: idOk ? '#34d399' : idBad ? '#f87171' : 'transparent' }}>
                  {idOk ? 'Available ✓' : availability === 'taken' ? 'Already taken' : availability === 'invalid' ? 'Min 3 chars, a–z 0–9 -' : ' '}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !idOk}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px 0', borderRadius: 14, fontSize: 15, fontWeight: 700,
                border: 'none', cursor: !idOk || loading ? 'not-allowed' : 'pointer',
                background: idOk && !loading ? 'linear-gradient(135deg, #A88A35 0%, #C9A84C 100%)' : 'rgba(255,255,255,0.06)',
                color: idOk && !loading ? '#fff' : 'rgba(255,255,255,0.28)',
                boxShadow: idOk && !loading ? '0 4px 20px rgba(201,168,76,0.45)' : 'none',
                marginTop: 6,
                transition: 'all 0.15s ease',
              }}
            >
              {loading ? (
                <><Loader2 style={{ width: 15, height: 15, animation: 'spin 0.8s linear infinite' }} /> Creating workspace…</>
              ) : (
                <>Create workspace <ArrowRight style={{ width: 15, height: 15 }} /></>
              )}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Step: Done ────────────────────────────────────────────────────────────
  return (
    <div style={wrapStyle}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

        {/* Success mark */}
        <div style={{ position: 'relative', marginBottom: 32 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(52,211,153,0.20) 0%, rgba(52,211,153,0.08) 100%)',
            border: '1px solid rgba(52,211,153,0.30)',
            boxShadow: '0 0 40px rgba(52,211,153,0.20)',
          }}>
            <Check style={{ width: 36, height: 36, color: '#34d399' }} />
          </div>
          {/* Pulse rings */}
          <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', border: '1px solid rgba(52,211,153,0.15)', animation: 'pulse 2s ease-out infinite' }} />
          <div style={{ position: 'absolute', inset: -22, borderRadius: '50%', border: '1px solid rgba(52,211,153,0.07)', animation: 'pulse 2s ease-out 0.4s infinite' }} />
        </div>

        <h1 style={{ fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui', fontSize: 32, fontWeight: 800, letterSpacing: '-0.025em', color: 'rgba(255,255,255,0.95)', margin: '0 0 10px' }}>
          Workspace created!
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, maxWidth: 300, margin: '0 auto 36px' }}>
          Your church is live. Head to the dashboard to start setting things up.
        </p>

        {/* Quick start hints */}
        <div style={{ width: '100%', background: 'linear-gradient(145deg, rgba(255,255,255,0.042) 0%, rgba(255,255,255,0.012) 100%)', border: '1px solid rgba(255,255,255,0.065)', borderRadius: 18, padding: '16px 20px', marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', margin: '0 0 2px' }}>Quick start</p>
          {[
            'Add people to your directory',
            'Create your first event',
            'Invite your team from Settings',
          ].map((hint, i) => (
            <div key={hint} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.20)', fontSize: 10, fontWeight: 700, color: '#C9A84C' }}>
                {i + 1}
              </div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.60)' }}>{hint}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => router.push(`/${createdSlug}/dashboard`)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '15px 0', borderRadius: 14, fontSize: 16, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #A88A35 0%, #C9A84C 100%)',
            color: '#fff', letterSpacing: '-0.010em',
            boxShadow: '0 6px 24px rgba(201,168,76,0.50)',
            transition: 'opacity 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.90')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Go to my dashboard
          <ArrowRight style={{ width: 16, height: 16 }} />
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.5); } }
      `}</style>
    </div>
  )
}

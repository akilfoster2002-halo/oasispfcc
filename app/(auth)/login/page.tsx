'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowRight, ArrowLeft, CheckCircle2, Building2 } from 'lucide-react'

// ─── Brand mark ───────────────────────────────────────────────────────────────

function AquilaMark() {
  return (
    <svg width="38" height="38" viewBox="0 0 32 32" fill="none">
      <defs>
        <radialGradient id="lm-bg" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#6366f1"/>
          <stop offset="100%" stopColor="#3730a3"/>
        </radialGradient>
        <radialGradient id="lm-iris" cx="40%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.95"/>
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.85"/>
        </radialGradient>
        <filter id="lm-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#lm-bg)"/>
      <rect x="0" y="0" width="32" height="14" rx="9" fill="rgba(255,255,255,0.10)"/>
      <rect x="0" y="7" width="32" height="7" fill="rgba(255,255,255,0)"/>
      <circle cx="16" cy="16" r="7" stroke="rgba(255,255,255,0.20)" strokeWidth="1"/>
      <circle cx="16" cy="16" r="4" fill="url(#lm-iris)" filter="url(#lm-glow)"/>
      <circle cx="13.5" cy="13.5" r="1.2" fill="rgba(255,255,255,0.55)"/>
    </svg>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    background: '#050810',
    backgroundImage: 'radial-gradient(ellipse 70% 60% at 20% 0%, rgba(79,70,229,0.15) 0%, transparent 65%), radial-gradient(ellipse 55% 45% at 80% 100%, rgba(124,58,237,0.09) 0%, transparent 65%)',
    fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)',
    WebkitFontSmoothing: 'antialiased',
  } as React.CSSProperties,

  card: {
    width: '100%',
    maxWidth: 380,
    background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)',
    backdropFilter: 'blur(32px) saturate(180%)',
    WebkitBackdropFilter: 'blur(32px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.065)',
    borderRadius: 24,
    boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 24px 64px rgba(0,0,0,0.45)',
    padding: '32px 28px',
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 12,
    fontSize: 14,
    outline: 'none',
    background: 'rgba(255,255,255,0.040)',
    border: '1px solid rgba(255,255,255,0.090)',
    color: 'rgba(255,255,255,0.88)',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    boxSizing: 'border-box',
  } as React.CSSProperties,
}

function fi(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'rgba(99,102,241,0.55)'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'
}
function fo(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.090)'
  e.currentTarget.style.boxShadow = 'none'
}

// ─── Inner content ────────────────────────────────────────────────────────────

function LoginContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const next = searchParams.get('next')

  // Step 1: find the church
  const [step, setStep] = useState<'church' | 'credentials'>('church')
  const [churchId, setChurchId] = useState('')
  const [church, setChurch] = useState<{ id: string; name: string; slug: string } | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')

  // Step 2: sign in
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signInLoading, setSignInLoading] = useState(false)
  const [signInError, setSignInError] = useState('')

  async function findChurch(e: React.FormEvent) {
    e.preventDefault()
    const slug = churchId.trim().toLowerCase()
    if (!slug) return
    setLookupLoading(true)
    setLookupError('')
    try {
      const res = await fetch(`/api/churches/${slug}`)
      if (!res.ok) {
        setLookupError('No workspace found with that ID. Check the spelling and try again.')
        return
      }
      const data = await res.json()
      if (!data.church) {
        setLookupError('No workspace found with that ID. Check the spelling and try again.')
        return
      }
      setChurch(data.church)
      setStep('credentials')
    } catch {
      setLookupError('Something went wrong. Check your connection and try again.')
    } finally {
      setLookupLoading(false)
    }
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    if (!church) return
    setSignInLoading(true)
    setSignInError('')
    try {
      const supabase = getSupabaseBrowser()
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setSignInError(err.message); return }
      router.push(next ?? `/${church.slug}/dashboard`)
    } finally {
      setSignInLoading(false)
    }
  }

  const urlError = searchParams.get('error')

  return (
    <div style={S.wrap}>

      {/* Brand */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 36 }}>
        <div style={{ position: 'relative' }}>
          <AquilaMark />
          <div style={{ position: 'absolute', inset: -8, borderRadius: 20, background: 'radial-gradient(circle, rgba(99,102,241,0.20) 0%, transparent 70%)', pointerEvents: 'none' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui', fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em', color: 'rgba(255,255,255,0.94)', margin: 0, lineHeight: 1 }}>
            Aquila
          </p>
          <p style={{ fontSize: 11, color: 'rgba(129,140,248,0.52)', letterSpacing: '0.08em', fontWeight: 500, margin: '4px 0 0' }}>
            BY OASIS PFCC
          </p>
        </div>
      </div>

      {/* ── Step 1: Church lookup ── */}
      {step === 'church' && (
        <div style={S.card}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.020em', color: 'rgba(255,255,255,0.94)', margin: '0 0 6px', fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui' }}>
              Sign in
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: 0 }}>
              Enter your church workspace ID to continue
            </p>
          </div>

          {(urlError || lookupError) && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, fontSize: 13, background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.22)' }}>
              {lookupError || 'Sign-in failed. Please try again.'}
            </div>
          )}

          <form onSubmit={findChurch} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>
                Church ID
              </label>
              <input
                type="text"
                required
                autoFocus
                autoComplete="off"
                value={churchId}
                onChange={e => { setChurchId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setLookupError('') }}
                placeholder="e.g. oasis-pfcc"
                style={S.input}
                onFocus={fi}
                onBlur={fo}
              />
              <p style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                Your workspace ID was set when your church was created
              </p>
            </div>

            <button
              type="submit"
              disabled={lookupLoading || !churchId.trim()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
                border: 'none', cursor: lookupLoading || !churchId.trim() ? 'not-allowed' : 'pointer',
                background: churchId.trim() && !lookupLoading ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' : 'rgba(255,255,255,0.06)',
                color: churchId.trim() && !lookupLoading ? '#fff' : 'rgba(255,255,255,0.30)',
                boxShadow: churchId.trim() && !lookupLoading ? '0 4px 18px rgba(99,102,241,0.40)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {lookupLoading ? 'Finding workspace…' : <>Continue <ArrowRight style={{ width: 15, height: 15 }} /></>}
            </button>
          </form>

          <p style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>
            New to Aquila?{' '}
            <Link href="/signup" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 500 }}>
              Create a church
            </Link>
          </p>
        </div>
      )}

      {/* ── Step 2: Credentials ── */}
      {step === 'credentials' && church && (
        <div style={S.card}>

          {/* Church confirmed banner */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
            padding: '12px 14px', borderRadius: 14,
            background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.18)',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.22)' }}>
              <Building2 style={{ width: 16, height: 16, color: '#34d399' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.88)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {church.name}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', margin: '2px 0 0' }}>
                {church.slug}
              </p>
            </div>
            <CheckCircle2 style={{ width: 16, height: 16, color: '#34d399', flexShrink: 0 }} />
          </div>

          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.020em', color: 'rgba(255,255,255,0.94)', margin: '0 0 5px', fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui' }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: 0 }}>
              Enter your credentials to sign in
            </p>
          </div>

          {signInError && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, fontSize: 13, background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.22)' }}>
              {signInError}
            </div>
          )}

          <form onSubmit={signIn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>
                Email
              </label>
              <input
                type="email" required autoFocus autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@church.org"
                style={S.input} onFocus={fi} onBlur={fo}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>
                Password
              </label>
              <input
                type="password" required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Your password"
                style={S.input} onFocus={fi} onBlur={fo}
              />
            </div>
            <button
              type="submit"
              disabled={signInLoading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
                border: 'none', cursor: signInLoading ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                color: '#fff',
                boxShadow: '0 4px 18px rgba(99,102,241,0.45)',
                opacity: signInLoading ? 0.65 : 1,
                marginTop: 4,
                transition: 'opacity 0.15s ease',
              }}
            >
              {signInLoading ? 'Signing in…' : <>Sign in <ArrowRight style={{ width: 15, height: 15 }} /></>}
            </button>
          </form>

          {/* Back link */}
          <button
            onClick={() => { setStep('church'); setSignInError(''); setEmail(''); setPassword('') }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              marginTop: 18, width: '100%', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.30)',
              transition: 'color 0.12s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.30)')}
          >
            <ArrowLeft style={{ width: 12, height: 12 }} />
            Not your church? Go back
          </button>
        </div>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

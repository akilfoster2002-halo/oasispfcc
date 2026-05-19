'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'

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

// ─── Login form ───────────────────────────────────────────────────────────────

function LoginContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const next = searchParams.get('next')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = getSupabaseBrowser()
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) {
        if (err.message.toLowerCase().includes('invalid login')) {
          setError('Incorrect email or password. Please try again.')
        } else if (err.message.toLowerCase().includes('email not confirmed')) {
          setError('Please confirm your email before signing in. Check your inbox.')
        } else {
          setError(err.message)
        }
        return
      }
      // Middleware handles routing to the right church dashboard
      router.push(next ?? '/')
      router.refresh()
    } finally {
      setLoading(false)
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

      <div style={S.card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.020em', color: 'rgba(255,255,255,0.94)', margin: '0 0 6px', fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui' }}>
            Welcome back
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: 0 }}>
            Sign in to your Aquila workspace
          </p>
        </div>

        {(urlError || error) && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, fontSize: 13, background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.22)', lineHeight: 1.5 }}>
            {error || 'Sign-in failed. Please try again.'}
          </div>
        )}

        <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>
              Email
            </label>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="you@church.org"
              style={S.input}
              onFocus={fi}
              onBlur={fo}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.50)' }}>
                Password
              </label>
              <Link href="/forgot-password" style={{ fontSize: 12, color: '#818cf8', textDecoration: 'none', fontWeight: 500 }}>
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="Your password"
                style={{ ...S.input, paddingRight: 42 }}
                onFocus={fi}
                onBlur={fo}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                  color: 'rgba(255,255,255,0.30)', display: 'flex', alignItems: 'center',
                }}
                tabIndex={-1}
              >
                {showPassword
                  ? <EyeOff style={{ width: 15, height: 15 }} />
                  : <Eye style={{ width: 15, height: 15 }} />
                }
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
              border: 'none', cursor: loading || !email.trim() || !password ? 'not-allowed' : 'pointer',
              background: !loading && email.trim() && password
                ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)'
                : 'rgba(255,255,255,0.06)',
              color: !loading && email.trim() && password ? '#fff' : 'rgba(255,255,255,0.28)',
              boxShadow: !loading && email.trim() && password ? '0 4px 18px rgba(99,102,241,0.40)' : 'none',
              marginTop: 4,
              transition: 'all 0.15s ease',
              opacity: loading ? 0.65 : 1,
            }}
          >
            {loading ? 'Signing in…' : <>Sign in <ArrowRight style={{ width: 15, height: 15 }} /></>}
          </button>
        </form>

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/signup" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 500 }}>
            Create one
          </Link>
        </p>
      </div>
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

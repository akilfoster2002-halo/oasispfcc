'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react'

function AquilaMark() {
  return (
    <svg width="38" height="38" viewBox="0 0 32 32" fill="none">
      <defs>
        <radialGradient id="rp-bg" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#6366f1"/>
          <stop offset="100%" stopColor="#3730a3"/>
        </radialGradient>
        <radialGradient id="rp-iris" cx="40%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.95"/>
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.85"/>
        </radialGradient>
        <filter id="rp-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#rp-bg)"/>
      <rect x="0" y="0" width="32" height="14" rx="9" fill="rgba(255,255,255,0.10)"/>
      <rect x="0" y="7" width="32" height="7" fill="rgba(255,255,255,0)"/>
      <circle cx="16" cy="16" r="7" stroke="rgba(255,255,255,0.20)" strokeWidth="1"/>
      <circle cx="16" cy="16" r="4" fill="url(#rp-iris)" filter="url(#rp-glow)"/>
      <circle cx="13.5" cy="13.5" r="1.2" fill="rgba(255,255,255,0.55)"/>
    </svg>
  )
}

const inputStyle: React.CSSProperties = {
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
}
function fi(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'rgba(99,102,241,0.55)'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'
}
function fo(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.090)'
  e.currentTarget.style.boxShadow = 'none'
}

const wrapStyle: React.CSSProperties = {
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
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 380,
  background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)',
  backdropFilter: 'blur(32px) saturate(180%)',
  WebkitBackdropFilter: 'blur(32px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.065)',
  borderRadius: 24,
  boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 24px 64px rgba(0,0,0,0.45)',
  padding: '32px 28px',
}

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState('')

  // Supabase sends the token in the URL hash; the client SDK picks it up automatically
  // on page load and sets a session. We just wait for that.
  useEffect(() => {
    const supabase = getSupabaseBrowser()

    // Check for error params in the URL
    const errorParam = searchParams.get('error')
    const errorDesc = searchParams.get('error_description')
    if (errorParam) {
      setSessionError(errorDesc ?? 'This reset link is invalid or has expired.')
      return
    }

    // Listen for the PASSWORD_RECOVERY event Supabase fires when the hash token is valid
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })

    // Also check if we already have a valid session (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })

    return () => subscription.unsubscribe()
  }, [searchParams])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const supabase = getSupabaseBrowser()
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(err.message)
        return
      }
      setDone(true)
      setTimeout(() => router.push('/'), 2500)
    } finally {
      setLoading(false)
    }
  }

  const passwordsMatch = confirmPassword && password === confirmPassword
  const passwordsMismatch = confirmPassword && password !== confirmPassword

  return (
    <div style={wrapStyle}>
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

      <div style={cardStyle}>
        {sessionError ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#f87171', marginBottom: 16, lineHeight: 1.5 }}>{sessionError}</p>
            <Link href="/forgot-password" style={{ fontSize: 13, color: '#818cf8', textDecoration: 'none', fontWeight: 500 }}>
              Request a new reset link →
            </Link>
          </div>
        ) : done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(52,211,153,0.20) 0%, rgba(52,211,153,0.08) 100%)',
              border: '1px solid rgba(52,211,153,0.30)',
            }}>
              <CheckCircle2 style={{ width: 24, height: 24, color: '#34d399' }} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.94)', margin: '0 0 8px' }}>
              Password updated!
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)', margin: 0 }}>
              Redirecting you to your workspace…
            </p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.020em', color: 'rgba(255,255,255,0.94)', margin: '0 0 6px', fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui' }}>
                Set new password
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: 0 }}>
                Choose a strong password for your account
              </p>
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, fontSize: 13, background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.22)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>
                  New password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoFocus
                    autoComplete="new-password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    placeholder="Min. 8 characters"
                    style={{ ...inputStyle, paddingRight: 42 }}
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
                    {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>
                  Confirm password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                  placeholder="Re-enter your password"
                  style={{
                    ...inputStyle,
                    borderColor: passwordsMismatch
                      ? 'rgba(248,113,113,0.45)'
                      : passwordsMatch
                      ? 'rgba(52,211,153,0.40)'
                      : 'rgba(255,255,255,0.090)',
                  }}
                  onFocus={fi}
                  onBlur={fo}
                />
                {passwordsMismatch && (
                  <p style={{ marginTop: 5, fontSize: 12, color: '#f87171' }}>Passwords don&apos;t match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !sessionReady || !password || !!passwordsMismatch}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
                  border: 'none',
                  cursor: loading || !sessionReady || !password || !!passwordsMismatch ? 'not-allowed' : 'pointer',
                  background: !loading && sessionReady && password && !passwordsMismatch
                    ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)'
                    : 'rgba(255,255,255,0.06)',
                  color: !loading && sessionReady && password && !passwordsMismatch ? '#fff' : 'rgba(255,255,255,0.28)',
                  boxShadow: !loading && sessionReady && password && !passwordsMismatch ? '0 4px 18px rgba(99,102,241,0.40)' : 'none',
                  marginTop: 4,
                  opacity: loading ? 0.65 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                {loading ? 'Updating…' : <>Update password <ArrowRight style={{ width: 15, height: 15 }} /></>}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  )
}

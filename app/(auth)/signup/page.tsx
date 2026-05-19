'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowRight, Eye, EyeOff, Mail } from 'lucide-react'

function AquilaMark() {
  return (
    <svg width="38" height="38" viewBox="0 0 32 32" fill="none">
      <defs>
        <radialGradient id="su-bg" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#6366f1"/>
          <stop offset="100%" stopColor="#3730a3"/>
        </radialGradient>
        <radialGradient id="su-iris" cx="40%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.95"/>
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.85"/>
        </radialGradient>
        <filter id="su-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#su-bg)"/>
      <rect x="0" y="0" width="32" height="14" rx="9" fill="rgba(255,255,255,0.10)"/>
      <rect x="0" y="7" width="32" height="7" fill="rgba(255,255,255,0)"/>
      <circle cx="16" cy="16" r="7" stroke="rgba(255,255,255,0.20)" strokeWidth="1"/>
      <circle cx="16" cy="16" r="4" fill="url(#su-iris)" filter="url(#su-glow)"/>
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

export default function SignupPage() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingConfirmation, setPendingConfirmation] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const supabase = getSupabaseBrowser()

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      })

      if (signUpErr) {
        if (signUpErr.message.toLowerCase().includes('already registered') ||
            signUpErr.message.toLowerCase().includes('already exists')) {
          setError('An account with this email already exists. Try signing in instead.')
        } else {
          setError(signUpErr.message)
        }
        return
      }

      // If email confirmation is required, session is null — show check-your-email screen
      if (!data.session) {
        setPendingConfirmation(true)
        return
      }

      // Email confirmation disabled — session is live, go straight to onboarding
      router.push('/onboarding')
    } finally {
      setLoading(false)
    }
  }

  const passwordsMatch = confirmPassword && password === confirmPassword
  const passwordsMismatch = confirmPassword && password !== confirmPassword

  const Brand = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 36 }}>
      <div style={{ position: 'relative' }}>
        <AquilaMark />
        <div style={{ position: 'absolute', inset: -8, borderRadius: 20, background: 'radial-gradient(circle, rgba(99,102,241,0.20) 0%, transparent 70%)', pointerEvents: 'none' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui', fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em', color: 'rgba(255,255,255,0.94)', margin: 0, lineHeight: 1 }}>Aquila</p>
        <p style={{ fontSize: 11, color: 'rgba(129,140,248,0.52)', letterSpacing: '0.08em', fontWeight: 500, margin: '4px 0 0' }}>BY OASIS PFCC</p>
      </div>
    </div>
  )

  // ── Email confirmation pending ──────────────────────────────────────────────
  if (pendingConfirmation) {
    return (
      <div style={wrapStyle}>
        <Brand />
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.20) 0%, rgba(129,140,248,0.10) 100%)',
              border: '1px solid rgba(129,140,248,0.25)',
            }}>
              <Mail style={{ width: 22, height: 22, color: '#818cf8' }} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.020em', color: 'rgba(255,255,255,0.94)', margin: '0 0 10px', fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui' }}>
              Confirm your email
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: '0 0 8px' }}>
              We sent a confirmation link to{' '}
              <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{email}</span>.
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.65, margin: '0 0 24px' }}>
              Click that link to activate your account and continue setting up your workspace.
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)' }}>
              Didn&apos;t receive it? Check your spam folder or{' '}
              <button
                onClick={() => setPendingConfirmation(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818cf8', fontSize: 12, fontWeight: 500, padding: 0 }}
              >
                go back
              </button>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Signup form ────────────────────────────────────────────────────────────
  return (
    <div style={wrapStyle}>
      <Brand />

      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.020em', color: 'rgba(255,255,255,0.94)', margin: '0 0 6px', fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui' }}>
            Create your account
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: 0 }}>
            You&apos;ll set up your church workspace next
          </p>
        </div>

        {error && (
          <div style={{ marginBottom: 18, padding: '10px 14px', borderRadius: 12, fontSize: 13, background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.22)', lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>Full name</label>
            <input
              type="text" required autoFocus autoComplete="name"
              value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Jane Smith"
              style={inputStyle} onFocus={fi} onBlur={fo}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>Email</label>
            <input
              type="email" required autoComplete="email"
              value={email} onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="jane@church.org"
              style={inputStyle} onFocus={fi} onBlur={fo}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password"
                value={password} onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="Min. 8 characters"
                style={{ ...inputStyle, paddingRight: 42 }} onFocus={fi} onBlur={fo}
              />
              <button
                type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'rgba(255,255,255,0.30)', display: 'flex', alignItems: 'center' }}
              >
                {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>Confirm password</label>
            <input
              type="password" required minLength={8} autoComplete="new-password"
              value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setError('') }}
              placeholder="Re-enter your password"
              style={{
                ...inputStyle,
                borderColor: passwordsMismatch
                  ? 'rgba(248,113,113,0.45)'
                  : passwordsMatch
                  ? 'rgba(52,211,153,0.40)'
                  : 'rgba(255,255,255,0.090)',
              }}
              onFocus={fi} onBlur={fo}
            />
            {passwordsMismatch && (
              <p style={{ marginTop: 5, fontSize: 12, color: '#f87171' }}>Passwords don&apos;t match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
              color: loading ? 'rgba(255,255,255,0.28)' : '#fff',
              boxShadow: loading ? 'none' : '0 4px 18px rgba(99,102,241,0.45)',
              opacity: loading ? 0.65 : 1,
              marginTop: 4,
              transition: 'all 0.15s ease',
            }}
          >
            {loading ? 'Creating account…' : <>Continue <ArrowRight style={{ width: 15, height: 15 }} /></>}
          </button>
        </form>

        <p style={{ marginTop: 22, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}

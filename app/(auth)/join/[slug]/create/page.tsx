'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowRight, Eye, EyeOff, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'

function AquilaMark() {
  return (
    <svg width="38" height="38" viewBox="0 0 32 32" fill="none">
      <defs>
        <radialGradient id="jc-bg" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#A88A35"/>
          <stop offset="100%" stopColor="#0C1829"/>
        </radialGradient>
        <radialGradient id="jc-iris" cx="40%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.95"/>
          <stop offset="100%" stopColor="#C9A84C" stopOpacity="0.85"/>
        </radialGradient>
        <filter id="jc-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#jc-bg)"/>
      <rect x="0" y="0" width="32" height="14" rx="9" fill="rgba(255,255,255,0.10)"/>
      <rect x="0" y="7" width="32" height="7" fill="rgba(255,255,255,0)"/>
      <circle cx="16" cy="16" r="7" stroke="rgba(255,255,255,0.20)" strokeWidth="1"/>
      <circle cx="16" cy="16" r="4" fill="url(#jc-iris)" filter="url(#jc-glow)"/>
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
  e.currentTarget.style.borderColor = 'rgba(201,168,76,0.55)'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.12)'
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
  backgroundImage: 'radial-gradient(ellipse 70% 60% at 20% 0%, rgba(79,127,196,0.15) 0%, transparent 65%), radial-gradient(ellipse 55% 45% at 80% 100%, rgba(79,127,196,0.09) 0%, transparent 65%)',
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

interface Church {
  id: string
  name: string
  slug: string
}

export default function JoinCreatePage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const router = useRouter()

  const [church, setChurch] = useState<Church | null>(null)
  const [churchLoading, setChurchLoading] = useState(true)
  const [churchError, setChurchError] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch(`/api/churches/${slug}`)
      .then(r => r.json())
      .then(({ church: c, error: e }) => {
        if (e || !c) { setChurchError('Church not found.'); return }
        setChurch(c)
      })
      .catch(() => setChurchError('Could not load church info.'))
      .finally(() => setChurchLoading(false))
  }, [slug])

  // If user is already signed in, just request membership directly
  useEffect(() => {
    const supabase = getSupabaseBrowser()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session || churchLoading) return
      const res = await fetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ churchSlug: slug }),
      })
      if (res.ok) setDone(true)
    })
  }, [slug, churchLoading])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setError('')
    setLoading(true)
    try {
      const supabase = getSupabaseBrowser()

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/${slug}/dashboard`,
        },
      })

      if (signUpErr) {
        if (signUpErr.message.toLowerCase().includes('already registered') ||
            signUpErr.message.toLowerCase().includes('already exists')) {
          // Try signing them in and requesting membership
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
          if (signInErr) {
            setError('An account with this email already exists. Try signing in from the login page.')
            return
          }
          const res = await fetch('/api/memberships', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ churchSlug: slug }),
          })
          if (res.ok) { setDone(true); return }
          setError('Could not request membership. Please contact your church admin.')
          return
        }
        setError(signUpErr.message)
        return
      }

      if (!data.session) {
        // Email confirmation required
        setDone(true)
        return
      }

      // Session is live — request membership
      const res = await fetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ churchSlug: slug }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Could not request membership.')
        return
      }
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  const passwordsMatch = confirmPassword && password === confirmPassword
  const passwordsMismatch = confirmPassword && password !== confirmPassword

  if (churchLoading) {
    return (
      <div style={{ ...wrapStyle, gap: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(201,168,76,0.25)', borderTopColor: '#A88A35', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (churchError) {
    return (
      <div style={wrapStyle}>
        <div style={cardStyle}>
          <p style={{ textAlign: 'center', fontSize: 14, color: '#f87171', margin: '0 0 16px' }}>{churchError}</p>
          <Link href="/" style={{ display: 'block', textAlign: 'center', fontSize: 13, color: '#C9A84C', textDecoration: 'none' }}>Go home</Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div style={wrapStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 36 }}>
          <div style={{ position: 'relative' }}>
            <AquilaMark />
            <div style={{ position: 'absolute', inset: -8, borderRadius: 20, background: 'radial-gradient(circle, rgba(201,168,76,0.20) 0%, transparent 70%)', pointerEvents: 'none' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui', fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em', color: 'rgba(255,255,255,0.94)', margin: 0, lineHeight: 1 }}>Aquila</p>
            <p style={{ fontSize: 11, color: 'rgba(201,168,76,0.52)', letterSpacing: '0.08em', fontWeight: 500, margin: '4px 0 0' }}>BY OASIS PFCC</p>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(52,211,153,0.20) 0%, rgba(52,211,153,0.08) 100%)',
              border: '1px solid rgba(52,211,153,0.30)',
            }}>
              <CheckCircle2 style={{ width: 24, height: 24, color: '#34d399' }} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.020em', color: 'rgba(255,255,255,0.94)', margin: '0 0 10px' }}>
              Request sent!
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: '0 0 8px' }}>
              Your request to join <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{church?.name}</span> has been sent.
              An admin will approve your access shortly.
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
              Check your email to confirm your account if you haven&apos;t already.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={wrapStyle}>
      {/* Brand */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 36 }}>
        <div style={{ position: 'relative' }}>
          <AquilaMark />
          <div style={{ position: 'absolute', inset: -8, borderRadius: 20, background: 'radial-gradient(circle, rgba(201,168,76,0.20) 0%, transparent 70%)', pointerEvents: 'none' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui', fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em', color: 'rgba(255,255,255,0.94)', margin: 0, lineHeight: 1 }}>Aquila</p>
          <p style={{ fontSize: 11, color: 'rgba(201,168,76,0.52)', letterSpacing: '0.08em', fontWeight: 500, margin: '4px 0 0' }}>BY OASIS PFCC</p>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ marginBottom: 22 }}>
          <Link
            href={`/join/${slug}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,0.30)', textDecoration: 'none', marginBottom: 16 }}
          >
            <ArrowLeft style={{ width: 12, height: 12 }} /> Back
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.020em', color: 'rgba(255,255,255,0.94)', margin: '0 0 5px', fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui' }}>
            Join {church?.name}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: 0 }}>
            Create your account to request access
          </p>
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, fontSize: 13, background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.22)', lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>Full name</label>
            <input type="text" required autoFocus autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" style={inputStyle} onFocus={fi} onBlur={fo} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>Email</label>
            <input type="email" required autoComplete="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }} placeholder="jane@church.org" style={inputStyle} onFocus={fi} onBlur={fo} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={password} onChange={e => { setPassword(e.target.value); setError('') }} placeholder="Min. 8 characters" style={{ ...inputStyle, paddingRight: 42 }} onFocus={fi} onBlur={fo} />
              <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'rgba(255,255,255,0.30)', display: 'flex', alignItems: 'center' }}>
                {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>Confirm password</label>
            <input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setError('') }} placeholder="Re-enter your password" style={{ ...inputStyle, borderColor: passwordsMismatch ? 'rgba(248,113,113,0.45)' : passwordsMatch ? 'rgba(52,211,153,0.40)' : 'rgba(255,255,255,0.090)' }} onFocus={fi} onBlur={fo} />
            {passwordsMismatch && <p style={{ marginTop: 5, fontSize: 12, color: '#f87171' }}>Passwords don&apos;t match</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #A88A35 0%, #C9A84C 100%)',
              color: loading ? 'rgba(255,255,255,0.28)' : '#fff',
              boxShadow: loading ? 'none' : '0 4px 18px rgba(201,168,76,0.40)',
              opacity: loading ? 0.65 : 1,
              marginTop: 4,
              transition: 'all 0.15s ease',
            }}
          >
            {loading
              ? <><Loader2 style={{ width: 15, height: 15, animation: 'spin 0.7s linear infinite' }} /> Joining…</>
              : <>Request to join <ArrowRight style={{ width: 15, height: 15 }} /></>
            }
          </button>
        </form>

        <p style={{ marginTop: 18, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>
          Already have an account?{' '}
          <Link href={`/login?next=/join/${slug}/create`} style={{ color: '#C9A84C', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { Check, AlertCircle, ArrowRight } from 'lucide-react'

interface InviteInfo {
  email: string
  role: string
  church: { name: string; slug: string }
  status: string
}

function AquilaMark() {
  return (
    <svg width="38" height="38" viewBox="0 0 32 32" fill="none">
      <defs>
        <radialGradient id="inv-bg" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#A88A35"/>
          <stop offset="100%" stopColor="#0C1829"/>
        </radialGradient>
        <radialGradient id="inv-iris" cx="40%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.95"/>
          <stop offset="100%" stopColor="#C9A84C" stopOpacity="0.85"/>
        </radialGradient>
        <filter id="inv-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#inv-bg)"/>
      <rect x="0" y="0" width="32" height="14" rx="9" fill="rgba(255,255,255,0.10)"/>
      <rect x="0" y="7" width="32" height="7" fill="rgba(255,255,255,0)"/>
      <circle cx="16" cy="16" r="7" stroke="rgba(255,255,255,0.20)" strokeWidth="1"/>
      <circle cx="16" cy="16" r="4" fill="url(#inv-iris)" filter="url(#inv-glow)"/>
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

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [loadError, setLoadError] = useState('')
  const [mode, setMode] = useState<'loading' | 'new-account' | 'sign-in' | 'done'>('loading')

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    async function init() {
      // If Supabase redirected here with a PKCE code, exchange it for a session first
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        await getSupabaseBrowser().auth.exchangeCodeForSession(code)
        // Remove the code from the URL without triggering a reload
        window.history.replaceState({}, '', window.location.pathname)
      }

      fetch(`/api/invites/${token}`)
        .then(r => r.json())
        .then(data => {
          if (data.error) { setLoadError(data.error); return }
          setInvite(data.invite)
          setEmail(data.invite.email)
          setMode('new-account')
        })
        .catch(() => setLoadError('Failed to load invite'))
    }
    init()
  }, [token])

  async function acceptWithNewAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!invite) return
    if (password !== confirmPassword) { setFormError('Passwords do not match.'); return }
    setFormError('')
    setSubmitting(true)
    try {
      const supabase = getSupabaseBrowser()
      // User is already signed in via the Supabase invite email — just set their name and password
      const { error: updateErr } = await supabase.auth.updateUser({
        password,
        data: { full_name: fullName, name: fullName },
      })
      if (updateErr) { setFormError(updateErr.message); return }
      const res = await fetch(`/api/invites/${token}/accept`, { method: 'POST' })
      if (!res.ok) { setFormError('Failed to accept invite'); return }
      setMode('done')
      setTimeout(() => router.push(`/${invite.church.slug}/dashboard`), 1500)
    } finally {
      setSubmitting(false)
    }
  }

  async function acceptWithExistingAccount(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)
    try {
      const supabase = getSupabaseBrowser()
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: signInPassword })
      if (signInErr) { setFormError(signInErr.message); return }
      const res = await fetch(`/api/invites/${token}/accept`, { method: 'POST' })
      if (!res.ok) { setFormError('Failed to accept invite'); return }
      setMode('done')
      setTimeout(() => router.push(`/${invite!.church.slug}/dashboard`), 1500)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
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
    }}>

      {/* Brand */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 36 }}>
        <div style={{ position: 'relative' }}>
          <AquilaMark />
          <div style={{ position: 'absolute', inset: -8, borderRadius: 20, background: 'radial-gradient(circle, rgba(201,168,76,0.20) 0%, transparent 70%)', pointerEvents: 'none' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui', fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em', color: 'rgba(255,255,255,0.94)', margin: 0, lineHeight: 1 }}>
            Aquila
          </p>
          <p style={{ fontSize: 11, color: 'rgba(201,168,76,0.52)', letterSpacing: '0.08em', fontWeight: 500, margin: '4px 0 0' }}>
            BY OASIS PFCC
          </p>
        </div>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.065)',
        borderRadius: 24,
        boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 24px 64px rgba(0,0,0,0.45)',
        padding: '32px 28px',
      }}>

        {/* Loading */}
        {mode === 'loading' && !loadError && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ width: 28, height: 28, border: '3px solid rgba(201,168,76,0.20)', borderTopColor: '#C9A84C', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {/* Error */}
        {loadError && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.22)' }}>
              <AlertCircle style={{ width: 24, height: 24, color: '#f87171' }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#f87171', margin: '0 0 6px' }}>Invalid invite</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: 0 }}>{loadError}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>This invite may have expired or already been used.</p>
          </div>
        )}

        {/* Done */}
        {mode === 'done' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)' }}>
              <Check style={{ width: 28, height: 28, color: '#34d399' }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.92)', margin: '0 0 6px' }}>
              Welcome to {invite?.church.name}!
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: 0 }}>Taking you to the dashboard…</p>
          </div>
        )}

        {/* Invite form */}
        {invite && (mode === 'new-account' || mode === 'sign-in') && (
          <>
            {/* Church banner */}
            <div style={{ marginBottom: 22, padding: '14px 16px', borderRadius: 14, textAlign: 'center', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.20)' }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.60)', margin: '0 0 4px' }}>You&apos;re invited to</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.92)', margin: '0 0 3px', letterSpacing: '-0.015em' }}>{invite.church.name}</p>
              <p style={{ fontSize: 12, color: '#C9A84C', margin: 0, textTransform: 'capitalize' }}>as {invite.role}</p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderRadius: 12, padding: 4, marginBottom: 20, background: 'rgba(255,255,255,0.040)', border: '1px solid rgba(255,255,255,0.065)' }}>
              {(['new-account', 'sign-in'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setFormError('') }}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 9, fontSize: 12, fontWeight: 500,
                    border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                    background: mode === m ? 'rgba(201,168,76,0.22)' : 'transparent',
                    color: mode === m ? '#C9A84C' : 'rgba(255,255,255,0.38)',
                    outline: mode === m ? '1px solid rgba(201,168,76,0.30)' : '1px solid transparent',
                  }}
                >
                  {m === 'new-account' ? 'Create Account' : 'Already have one'}
                </button>
              ))}
            </div>

            {formError && (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, fontSize: 13, background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.22)' }}>
                {formError}
              </div>
            )}

            {/* New account */}
            {mode === 'new-account' && (
              <form onSubmit={acceptWithNewAccount} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>Full name</label>
                  <input type="text" required autoFocus value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" style={inputStyle} onFocus={fi} onBlur={fo} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>Email</label>
                  <input type="email" value={invite.email} readOnly style={{ ...inputStyle, opacity: 0.55, cursor: 'default' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>Create password</label>
                  <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" style={inputStyle} onFocus={fi} onBlur={fo} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>Confirm password</label>
                  <input
                    type="password" required minLength={8}
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    style={{
                      ...inputStyle,
                      borderColor: confirmPassword && confirmPassword !== password
                        ? 'rgba(248,113,113,0.45)'
                        : confirmPassword && confirmPassword === password
                        ? 'rgba(52,211,153,0.40)'
                        : 'rgba(255,255,255,0.090)',
                    }}
                    onFocus={fi} onBlur={fo}
                  />
                  {confirmPassword && confirmPassword !== password && (
                    <p style={{ marginTop: 5, fontSize: 12, color: '#f87171' }}>Passwords don&apos;t match</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
                    border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg, #A88A35 0%, #C9A84C 100%)',
                    color: '#fff', boxShadow: '0 4px 18px rgba(201,168,76,0.45)',
                    opacity: submitting ? 0.65 : 1, marginTop: 4,
                  }}
                >
                  {submitting ? 'Joining…' : <>{`Join ${invite.church.name}`} <ArrowRight style={{ width: 15, height: 15 }} /></>}
                </button>
              </form>
            )}

            {/* Sign in to existing */}
            {mode === 'sign-in' && (
              <form onSubmit={acceptWithExistingAccount} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>Email</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoFocus style={inputStyle} onFocus={fi} onBlur={fo} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>Password</label>
                  <input type="password" required value={signInPassword} onChange={e => setSignInPassword(e.target.value)} placeholder="Your password" style={inputStyle} onFocus={fi} onBlur={fo} />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
                    border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg, #A88A35 0%, #C9A84C 100%)',
                    color: '#fff', boxShadow: '0 4px 18px rgba(201,168,76,0.45)',
                    opacity: submitting ? 0.65 : 1, marginTop: 4,
                  }}
                >
                  {submitting ? 'Joining…' : <>{`Sign In & Join`} <ArrowRight style={{ width: 15, height: 15 }} /></>}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}

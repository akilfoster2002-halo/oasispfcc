'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react'

function AquilaMark() {
  return (
    <svg width="38" height="38" viewBox="0 0 32 32" fill="none">
      <defs>
        <radialGradient id="fp-bg" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#6366f1"/>
          <stop offset="100%" stopColor="#3730a3"/>
        </radialGradient>
        <radialGradient id="fp-iris" cx="40%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.95"/>
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.85"/>
        </radialGradient>
        <filter id="fp-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#fp-bg)"/>
      <rect x="0" y="0" width="32" height="14" rx="9" fill="rgba(255,255,255,0.10)"/>
      <rect x="0" y="7" width="32" height="7" fill="rgba(255,255,255,0)"/>
      <circle cx="16" cy="16" r="7" stroke="rgba(255,255,255,0.20)" strokeWidth="1"/>
      <circle cx="16" cy="16" r="4" fill="url(#fp-iris)" filter="url(#fp-glow)"/>
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = getSupabaseBrowser()
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) {
        setError(err.message)
        return
      }
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

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
        {sent ? (
          /* ── Sent state ── */
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
              Check your email
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, margin: '0 0 24px' }}>
              We sent a password reset link to <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{email}</span>.
              It may take a minute to arrive.
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: '0 0 20px' }}>
              Didn&apos;t receive it? Check your spam folder or{' '}
              <button
                onClick={() => setSent(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818cf8', fontSize: 12, fontWeight: 500, padding: 0 }}
              >
                try again
              </button>.
            </p>
            <Link
              href="/login"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 13, color: 'rgba(255,255,255,0.40)', textDecoration: 'none',
              }}
            >
              <ArrowLeft style={{ width: 13, height: 13 }} /> Back to sign in
            </Link>
          </div>
        ) : (
          /* ── Form state ── */
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.020em', color: 'rgba(255,255,255,0.94)', margin: '0 0 6px', fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui' }}>
                Reset your password
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: 0 }}>
                Enter your email and we&apos;ll send you a reset link
              </p>
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, fontSize: 13, background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.22)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.50)' }}>
                  Email address
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="you@church.org"
                  style={inputStyle}
                  onFocus={fi}
                  onBlur={fo}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
                  border: 'none', cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                  background: !loading && email.trim()
                    ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)'
                    : 'rgba(255,255,255,0.06)',
                  color: !loading && email.trim() ? '#fff' : 'rgba(255,255,255,0.28)',
                  boxShadow: !loading && email.trim() ? '0 4px 18px rgba(99,102,241,0.40)' : 'none',
                  marginTop: 4,
                  opacity: loading ? 0.65 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                {loading ? 'Sending…' : <>Send reset link <ArrowRight style={{ width: 15, height: 15 }} /></>}
              </button>
            </form>

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Link
                href="/login"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 12, color: 'rgba(255,255,255,0.30)', textDecoration: 'none',
                }}
              >
                <ArrowLeft style={{ width: 12, height: 12 }} /> Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowRight, Eye, EyeOff, Key } from 'lucide-react'
import { AuthShell, authStyles, inputFocus, inputBlur } from '../_components/AuthShell'
import { normalizeAccessKey } from '@/lib/access-key'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

    // Client-side normalize. If the user typed something, it must be a valid shape.
    // The server re-normalizes too — this is just for fast feedback.
    let normalizedKey: string | undefined
    if (accessKey.trim()) {
      const n = normalizeAccessKey(accessKey)
      if (!n) {
        setError('Access keys are 8 characters, like XXXX-XXXX.')
        return
      }
      normalizedKey = n
    }

    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName,
          email,
          password,
          accessKey: normalizedKey,
        }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        const lower = (data.error ?? '').toLowerCase()
        if (lower.includes('already registered') || lower.includes('already exists') || lower.includes('already been registered')) {
          setError('An account with this email already exists. Try signing in instead.')
        } else if (res.status === 429) {
          setError(data.error ?? 'Too many attempts. Please try again in a few minutes.')
        } else {
          setError(data.error ?? 'Something went wrong. Please try again.')
        }
        return
      }

      // The route already established a session via cookies; do a sign-in fallback
      // only if it didn't (e.g. older deployment). Either way we hard-redirect so the
      // browser picks up fresh session cookies cleanly.
      if (!data.sessionEstablished) {
        const supabase = getSupabaseBrowser()
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) {
          setError(signInErr.message)
          return
        }
      }

      window.location.href = data.slug ? `/${data.slug}/dashboard` : '/onboarding'
    } finally {
      setLoading(false)
    }
  }

  const passwordsMatch = !!confirmPassword && password === confirmPassword
  const passwordsMismatch = !!confirmPassword && password !== confirmPassword

  return (
    <AuthShell
      title="Create your account"
      subtitle="Have a church key? Enter it below to join your team."
      error={error}
      footer={
        <p style={{ marginTop: 22, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
        </p>
      }
    >
      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={authStyles.label}>Full name</label>
          <input
            type="text" required autoFocus autoComplete="name"
            value={fullName} onChange={e => setFullName(e.target.value)}
            placeholder="Jane Smith"
            style={authStyles.input} onFocus={inputFocus} onBlur={inputBlur}
          />
        </div>

        <div>
          <label style={authStyles.label}>Email</label>
          <input
            type="email" required autoComplete="email"
            value={email} onChange={e => { setEmail(e.target.value); setError('') }}
            placeholder="jane@church.org"
            style={authStyles.input} onFocus={inputFocus} onBlur={inputBlur}
          />
        </div>

        <div>
          <label style={authStyles.label}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password"
              value={password} onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Min. 8 characters"
              style={{ ...authStyles.input, paddingRight: 42 }} onFocus={inputFocus} onBlur={inputBlur}
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
          <label style={authStyles.label}>Confirm password</label>
          <input
            type="password" required minLength={8} autoComplete="new-password"
            value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setError('') }}
            placeholder="Re-enter your password"
            style={{
              ...authStyles.input,
              borderColor: passwordsMismatch
                ? 'rgba(248,113,113,0.45)'
                : passwordsMatch
                ? 'rgba(52,211,153,0.40)'
                : 'rgba(255,255,255,0.090)',
            }}
            onFocus={inputFocus} onBlur={inputBlur}
          />
          {passwordsMismatch && (
            <p style={{ marginTop: 5, fontSize: 12, color: '#f87171' }}>Passwords don&apos;t match</p>
          )}
        </div>

        <div>
          <label style={authStyles.label}>
            Church access key{' '}
            <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>(optional)</span>
          </label>
          <div style={{ position: 'relative' }}>
            <Key style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: accessKey ? '#818cf8' : 'rgba(255,255,255,0.22)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={accessKey}
              onChange={e => { setAccessKey(e.target.value.toUpperCase()); setError('') }}
              placeholder="XXXX-XXXX"
              maxLength={9}
              style={{
                ...authStyles.input,
                paddingLeft: 36,
                fontFamily: 'monospace',
                letterSpacing: '0.08em',
                fontSize: 15,
                borderColor: accessKey ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.090)',
              }}
              onFocus={inputFocus} onBlur={inputBlur}
            />
          </div>
          <p style={{ marginTop: 5, fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
            Get this from your church admin to join their workspace.
          </p>
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
          {loading ? 'Creating account…' : <>Create account <ArrowRight style={{ width: 15, height: 15 }} /></>}
        </button>
      </form>
    </AuthShell>
  )
}

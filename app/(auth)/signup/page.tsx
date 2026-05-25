'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowRight, Eye, EyeOff, Key, Gift } from 'lucide-react'
import { AuthShell } from '../_components/AuthShell'
import { Button, FieldGroup, IconButton, Input } from '@/components/ui'
import { normalizeAccessKey } from '@/lib/access-key'

function SignupForm() {
  const searchParams = useSearchParams()
  const refCode = searchParams.get('ref') ?? ''

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

    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }

    let normalizedKey: string | undefined
    if (accessKey.trim()) {
      const n = normalizeAccessKey(accessKey)
      if (!n) { setError('Access keys are 8 characters, like XXXX-XXXX.'); return }
      normalizedKey = n
    }

    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fullName, email, password, accessKey: normalizedKey, refCode: refCode || undefined }),
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

      if (!data.sessionEstablished) {
        const supabase = getSupabaseBrowser()
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) { setError(signInErr.message); return }
      }
      window.location.href = data.slug ? `/${data.slug}/dashboard` : '/onboarding'
    } finally {
      setLoading(false)
    }
  }

  const passwordsMatch    = !!confirmPassword && password === confirmPassword
  const passwordsMismatch = !!confirmPassword && password !== confirmPassword

  return (
    <AuthShell
      title="Create your account"
      subtitle="Have a church key? Enter it below to join your team."
      error={error}
      footer={
        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--ds-text-tertiary)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--ds-accent)', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
        </p>
      }
    >
      {refCode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 12, marginBottom: 4,
          background: 'linear-gradient(135deg, rgba(201,168,76,0.10) 0%, rgba(201,168,76,0.05) 100%)',
          border: '1px solid rgba(201,168,76,0.22)',
        }}>
          <Gift style={{ width: 15, height: 15, color: '#C9A84C', flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: 'rgba(201,168,76,0.85)', margin: 0, letterSpacing: '-0.01em' }}>
            You were invited — sign up to unlock <strong>+5 bonus messages</strong> for your first day.
          </p>
        </div>
      )}
      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FieldGroup label="Full name" htmlFor="name">
          <Input
            id="name"
            type="text" required autoFocus autoComplete="name"
            value={fullName} onChange={e => setFullName(e.target.value)}
            placeholder="Jane Smith"
          />
        </FieldGroup>

        <FieldGroup label="Email" htmlFor="email">
          <Input
            id="email"
            type="email" required autoComplete="email"
            value={email} onChange={e => { setEmail(e.target.value); setError('') }}
            placeholder="jane@church.org"
          />
        </FieldGroup>

        <FieldGroup label="Password" htmlFor="password">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password"
            value={password} onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="Min. 8 characters"
            rightAdornment={
              <IconButton
                type="button"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{ width: 32, height: 32 }}
              >
                {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
              </IconButton>
            }
          />
        </FieldGroup>

        <FieldGroup
          label="Confirm password"
          htmlFor="confirmPassword"
          error={passwordsMismatch ? "Passwords don't match" : undefined}
        >
          <Input
            id="confirmPassword"
            type="password" required minLength={8} autoComplete="new-password"
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setError('') }}
            placeholder="Re-enter your password"
            state={passwordsMismatch ? 'error' : passwordsMatch ? 'success' : 'default'}
          />
        </FieldGroup>

        <FieldGroup
          label="Church access key"
          hint="(optional)"
          htmlFor="accessKey"
          helper="Get this from your church admin to join their workspace."
        >
          <Input
            id="accessKey"
            type="text"
            value={accessKey}
            onChange={e => { setAccessKey(e.target.value.toUpperCase()); setError('') }}
            placeholder="XXXX-XXXX"
            maxLength={9}
            leftAdornment={<Key style={{ width: 14, height: 14, color: accessKey ? 'var(--ds-accent)' : 'var(--ds-text-faint)' }} />}
            style={{
              fontFamily: 'var(--font-geist-mono), monospace',
              letterSpacing: '0.10em',
              fontSize: 14,
            }}
            state={accessKey && accessKey.length >= 8 ? 'default' : 'default'}
          />
        </FieldGroup>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          rightIcon={!loading ? <ArrowRight style={{ width: 16, height: 16 }} /> : undefined}
          style={{ marginTop: 8 }}
        >
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}

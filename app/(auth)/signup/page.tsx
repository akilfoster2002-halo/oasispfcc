'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowRight, Eye, EyeOff, Key } from 'lucide-react'
import { AuthShell } from '../_components/AuthShell'
import { Button, FieldGroup, IconButton, Input } from '@/components/ui'
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
        body: JSON.stringify({ name: fullName, email, password, accessKey: normalizedKey }),
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

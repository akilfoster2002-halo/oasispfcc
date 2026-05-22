'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { AuthShell } from '../_components/AuthShell'
import { Button, FieldGroup, IconButton, Input } from '@/components/ui'

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
        // NOTE: We no longer special-case "email not confirmed" because /api/auth/signup
        // creates users with email_confirm: true. If email verification is ever turned
        // back on, restore that branch — otherwise users see the raw Supabase message.
        if (err.message.toLowerCase().includes('invalid login')) {
          setError('Incorrect email or password. Please try again.')
        } else {
          setError(err.message)
        }
        return
      }
      router.push(next ?? '/')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const urlError = searchParams.get('error')
  const displayError = error || (urlError ? 'Sign-in failed. Please try again.' : '')
  const canSubmit = !loading && !!email.trim() && !!password

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Aquila workspace"
      error={displayError}
      footer={
        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--ds-text-tertiary)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/signup" style={{ color: 'var(--ds-accent)', textDecoration: 'none', fontWeight: 500 }}>
            Create one
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FieldGroup label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            placeholder="you@church.org"
          />
        </FieldGroup>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label htmlFor="password" className="ds-label" style={{ marginBottom: 0 }}>Password</label>
            <Link href="/forgot-password" style={{ fontSize: 13, color: 'var(--ds-accent)', textDecoration: 'none', fontWeight: 500 }}>
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="Your password"
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
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canSubmit}
          loading={loading}
          rightIcon={!loading ? <ArrowRight style={{ width: 16, height: 16 }} /> : undefined}
          style={{ marginTop: 8 }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

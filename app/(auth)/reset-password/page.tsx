'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { AuthShell } from '../_components/AuthShell'
import { Button, FieldGroup, IconButton, Input } from '@/components/ui'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword]       = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [done, setDone]                       = useState(false)
  const [error, setError]                     = useState('')
  const [sessionReady, setSessionReady]       = useState(false)
  const [sessionError, setSessionError]       = useState('')

  useEffect(() => {
    const supabase = getSupabaseBrowser()
    const errorParam = searchParams.get('error')
    const errorDesc  = searchParams.get('error_description')
    if (errorParam) {
      setSessionError(errorDesc ?? 'This reset link is invalid or has expired.')
      return
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSessionReady(true)
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })
    return () => subscription.unsubscribe()
  }, [searchParams])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)
    setError('')
    try {
      const supabase = getSupabaseBrowser()
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) { setError(err.message); return }
      setDone(true)
      setTimeout(() => router.push('/'), 2500)
    } finally {
      setLoading(false)
    }
  }

  const passwordsMatch    = !!confirmPassword && password === confirmPassword
  const passwordsMismatch = !!confirmPassword && password !== confirmPassword

  if (done) {
    return (
      <AuthShell title="Password updated">
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', margin: '0 auto 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(90,209,153,0.20) 0%, rgba(90,209,153,0.08) 100%)',
            border: '1px solid rgba(90,209,153,0.30)',
          }}>
            <CheckCircle2 style={{ width: 24, height: 24, color: '#5ad199' }} />
          </div>
          <p style={{ fontSize: 14, color: 'rgba(255,248,225,0.42)', margin: 0 }}>
            Redirecting you to your workspace…
          </p>
        </div>
      </AuthShell>
    )
  }

  if (sessionError) {
    return (
      <AuthShell title="Link expired" error={sessionError}>
        <Link href="/forgot-password" style={{ display: 'block', textAlign: 'center', fontSize: 14, color: '#C9A84C', textDecoration: 'none', fontWeight: 500 }}>
          Request a new reset link →
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Set new password"
      subtitle="Choose a strong password for your account."
      error={error}
    >
      <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FieldGroup label="New password" htmlFor="password">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            required minLength={8} autoFocus autoComplete="new-password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
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
          htmlFor="confirm"
          error={passwordsMismatch ? "Passwords don't match" : undefined}
        >
          <Input
            id="confirm"
            type="password" required minLength={8} autoComplete="new-password"
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setError('') }}
            placeholder="Re-enter your password"
            state={passwordsMismatch ? 'error' : passwordsMatch ? 'success' : 'default'}
          />
        </FieldGroup>

        <Button
          type="submit"
          variant="primary" size="lg" fullWidth
          loading={loading}
          disabled={!sessionReady}
          rightIcon={!loading ? <ArrowRight style={{ width: 16, height: 16 }} /> : undefined}
          style={{ marginTop: 8 }}
        >
          {loading ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  )
}

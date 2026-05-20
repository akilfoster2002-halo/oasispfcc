'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { AuthShell, authStyles, inputFocus, inputBlur } from '../_components/AuthShell'

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
      // Middleware handles routing to the right church dashboard
      router.push(next ?? '/')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const urlError = searchParams.get('error')
  const displayError = error || (urlError ? 'Sign-in failed. Please try again.' : '')
  const submitReady = !loading && !!email.trim() && !!password

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Aquila workspace"
      error={displayError}
      footer={
        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/signup" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 500 }}>
            Create one
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={authStyles.label}>Email</label>
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            placeholder="you@church.org"
            style={authStyles.input}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ ...authStyles.label, marginBottom: 0 }}>Password</label>
            <Link href="/forgot-password" style={{ fontSize: 12, color: '#818cf8', textDecoration: 'none', fontWeight: 500 }}>
              Forgot password?
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Your password"
              style={{ ...authStyles.input, paddingRight: 42 }}
              onFocus={inputFocus}
              onBlur={inputBlur}
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

        <button
          type="submit"
          disabled={!submitReady}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
            border: 'none', cursor: submitReady ? 'pointer' : 'not-allowed',
            background: submitReady
              ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)'
              : 'rgba(255,255,255,0.06)',
            color: submitReady ? '#fff' : 'rgba(255,255,255,0.28)',
            boxShadow: submitReady ? '0 4px 18px rgba(99,102,241,0.40)' : 'none',
            marginTop: 4,
            transition: 'all 0.15s ease',
            opacity: loading ? 0.65 : 1,
          }}
        >
          {loading ? 'Signing in…' : <>Sign in <ArrowRight style={{ width: 15, height: 15 }} /></>}
        </button>
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

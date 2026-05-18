'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { Church, ArrowRight } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'email' | 'google'>('email')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const supabase = getSupabaseBrowser()
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      })
      if (err) { setError(err.message); return }
      // Sign in immediately (email is auto-confirmed on Supabase)
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) { setError(signInErr.message); return }
      router.push('/onboarding')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    })
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(180deg, rgba(8,12,26,1) 0%, rgba(10,14,35,1) 100%)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', boxShadow: '0 0 16px rgba(129,140,248,0.40)' }}
        >
          <Church className="w-4.5 h-4.5 text-white" />
        </div>
        <span className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>Church-Link</span>
      </div>

      <div
        className="w-full max-w-sm p-8 rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
          border: '1px solid rgba(255,255,255,0.09)',
        }}
      >
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'rgba(255,255,255,0.92)' }}>
            Create your account
          </h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
            You'll set up your church next
          </p>
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.20)' }}>
            {error}
          </div>
        )}

        {/* Tabs */}
        <div
          className="flex rounded-xl p-1 mb-6"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {(['email', 'google'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 py-2 text-xs font-medium rounded-lg transition-all"
              style={{
                background: mode === m ? 'rgba(99,102,241,0.25)' : 'transparent',
                border: mode === m ? '1px solid rgba(129,140,248,0.30)' : '1px solid transparent',
                color: mode === m ? '#818cf8' : 'rgba(255,255,255,0.40)',
              }}
            >
              {m === 'email' ? 'Email & Password' : 'Google'}
            </button>
          ))}
        </div>

        {mode === 'email' ? (
          <form onSubmit={handleEmailSignup} className="space-y-4">
            {[
              { label: 'Full name', value: fullName, set: setFullName, type: 'text', placeholder: 'Jane Smith' },
              { label: 'Email', value: email, set: setEmail, type: 'email', placeholder: 'jane@church.org' },
              { label: 'Password', value: password, set: setPassword, type: 'password', placeholder: 'Min. 8 characters' },
            ].map(({ label, value, set, type, placeholder }) => (
              <div key={label}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {label}
                </label>
                <input
                  type={type}
                  required
                  minLength={type === 'password' ? 8 : undefined}
                  value={value}
                  onChange={e => set(e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    color: 'rgba(255,255,255,0.88)',
                  }}
                />
              </div>
            ))}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all mt-2"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                color: '#fff',
                boxShadow: '0 4px 16px rgba(99,102,241,0.40)',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Creating account…' : <>Continue <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        ) : (
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-medium transition-all"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.80)',
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        )}

        <p className="mt-6 text-center text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
          Already have an account?{' '}
          <Link href="/login" className="font-medium" style={{ color: '#818cf8' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

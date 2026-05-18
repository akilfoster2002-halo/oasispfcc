'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { Church, Check, AlertCircle } from 'lucide-react'

interface InviteInfo {
  email: string
  role: string
  church: { name: string; slug: string }
  status: string
}

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [loadError, setLoadError] = useState('')
  const [mode, setMode] = useState<'loading' | 'new-account' | 'sign-in' | 'done'>('loading')

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Load invite info
  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setLoadError(data.error); return }
        setInvite(data.invite)
        setEmail(data.invite.email)
        setMode('new-account')
      })
      .catch(() => setLoadError('Failed to load invite'))
  }, [token])

  async function acceptWithNewAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!invite) return
    setFormError('')
    setSubmitting(true)
    try {
      const supabase = getSupabaseBrowser()

      // Create account
      const { error: signUpErr } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: { data: { full_name: fullName, name: fullName } },
      })
      if (signUpErr) { setFormError(signUpErr.message); return }

      // Sign in
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: invite.email,
        password,
      })
      if (signInErr) { setFormError(signInErr.message); return }

      // Accept the invite
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

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.88)',
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(180deg, rgba(8,12,26,1) 0%, rgba(10,14,35,1) 100%)' }}
    >
      <div className="flex items-center gap-3 mb-10">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', boxShadow: '0 0 16px rgba(129,140,248,0.40)' }}>
          <Church className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>Church-Link</span>
      </div>

      <div className="w-full max-w-sm p-8 rounded-3xl"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.09)' }}>

        {mode === 'loading' && !loadError && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
          </div>
        )}

        {loadError && (
          <div className="text-center py-8">
            <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: '#f87171' }} />
            <p className="text-sm" style={{ color: '#f87171' }}>{loadError}</p>
            <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.28)' }}>
              This invite may have expired or already been used.
            </p>
          </div>
        )}

        {mode === 'done' && (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.25)' }}>
              <Check className="w-7 h-7" style={{ color: '#34d399' }} />
            </div>
            <p className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.90)' }}>
              Welcome to {invite?.church.name}!
            </p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Taking you to the dashboard…</p>
          </div>
        )}

        {invite && (mode === 'new-account' || mode === 'sign-in') && (
          <>
            <div className="mb-6 text-center">
              <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>You're invited to</p>
              <p className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.92)' }}>{invite.church.name}</p>
              <p className="text-xs mt-1 capitalize" style={{ color: '#818cf8' }}>as {invite.role}</p>
            </div>

            {/* Tab toggle */}
            <div className="flex rounded-xl p-1 mb-6"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {(['new-account', 'sign-in'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className="flex-1 py-2 text-xs font-medium rounded-lg transition-all"
                  style={{
                    background: mode === m ? 'rgba(99,102,241,0.25)' : 'transparent',
                    border: mode === m ? '1px solid rgba(129,140,248,0.30)' : '1px solid transparent',
                    color: mode === m ? '#818cf8' : 'rgba(255,255,255,0.40)',
                  }}>
                  {m === 'new-account' ? 'Create Account' : 'Sign In'}
                </button>
              ))}
            </div>

            {formError && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.20)' }}>
                {formError}
              </div>
            )}

            {mode === 'new-account' ? (
              <form onSubmit={acceptWithNewAccount} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Full name</label>
                  <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                    placeholder="Jane Smith" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Email</label>
                  <input type="email" value={invite.email} readOnly
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none opacity-60" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Password</label>
                  <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', color: '#fff', opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? 'Joining…' : `Join ${invite.church.name}`}
                </button>
              </form>
            ) : (
              <form onSubmit={acceptWithExistingAccount} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Password</label>
                  <input type="password" required value={signInPassword} onChange={e => setSignInPassword(e.target.value)}
                    placeholder="Your password" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', color: '#fff', opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? 'Joining…' : `Sign In & Join ${invite.church.name}`}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}

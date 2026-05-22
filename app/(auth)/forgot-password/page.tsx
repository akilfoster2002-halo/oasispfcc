'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react'
import { AuthShell } from '../_components/AuthShell'
import { Button, FieldGroup, Input } from '@/components/ui'

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = getSupabaseBrowser()
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) { setError(err.message); return }
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle={`We sent a reset link to ${email}.`}>
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', margin: '0 auto 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(201,168,76,0.20) 0%, rgba(201,168,76,0.08) 100%)',
            border: '1px solid rgba(201,168,76,0.25)',
          }}>
            <Mail style={{ width: 22, height: 22, color: '#C9A84C' }} />
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,248,225,0.40)', lineHeight: 1.65, margin: '0 0 20px' }}>
            It may take a minute to arrive. Check your spam folder or{' '}
            <button
              onClick={() => setSent(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C9A84C', fontSize: 13, fontWeight: 500, padding: 0 }}
            >
              try again
            </button>.
          </p>
          <Link
            href="/login"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,248,225,0.30)', textDecoration: 'none' }}
          >
            <ArrowLeft style={{ width: 13, height: 13 }} /> Back to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter your email and we'll send you a reset link."
      error={error}
      footer={
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,248,225,0.30)', textDecoration: 'none' }}>
            <ArrowLeft style={{ width: 13, height: 13 }} /> Back to sign in
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FieldGroup label="Email address" htmlFor="email">
          <Input
            id="email"
            type="email" required autoFocus autoComplete="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            placeholder="you@church.org"
          />
        </FieldGroup>

        <Button
          type="submit"
          variant="primary" size="lg" fullWidth
          loading={loading}
          disabled={!email.trim()}
          rightIcon={!loading ? <ArrowRight style={{ width: 16, height: 16 }} /> : undefined}
          style={{ marginTop: 4 }}
        >
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthShell>
  )
}

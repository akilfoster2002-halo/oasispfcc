'use client'

import { use, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { DollarSign, Lock } from 'lucide-react'

const PRESET_AMOUNTS = [25, 50, 100, 250, 500]
const FUNDS = ['General', 'Missions', 'Building Fund', 'Youth Ministry', 'Benevolence']

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  fontSize: 14,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'rgba(255,255,255,0.90)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.40)',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

export default function GivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [church, setChurch] = useState<{ id: string; name: string } | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [preset, setPreset] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [fund, setFund] = useState('General')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    anonClient()
      .from('churches')
      .select('id, name')
      .eq('slug', slug)
      .single()
      .then(({ data }) => {
        if (data) setChurch(data)
        else setNotFound(true)
      })
  }, [slug])

  const amount = preset ?? (customAmount ? parseFloat(customAmount) : 0)

  async function handleGive(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || amount < 1) { setError('Please enter a valid amount.'); return }
    if (!name.trim()) { setError('Please enter your name.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/giving/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, amount, fund, name: name.trim(), email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      window.location.href = data.url
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', background: '#050810', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
        <p style={{ color: 'rgba(255,255,255,0.40)', fontSize: 15 }}>Church not found.</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050810', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: 'var(--font-geist-sans, system-ui)' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, rgba(52,211,153,0.22), rgba(16,185,129,0.10))', border: '1px solid rgba(52,211,153,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <DollarSign style={{ width: 26, height: 26, color: '#34d399' }} />
          </div>
          {church ? (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.94)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Give to {church.name}</h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.36)', margin: 0 }}>Your generosity makes a difference.</p>
            </>
          ) : (
            <div style={{ height: 52, borderRadius: 10, background: 'rgba(255,255,255,0.05)', width: 240, margin: '0 auto' }} />
          )}
        </div>

        <div style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)', backdropFilter: 'blur(32px) saturate(180%)', WebkitBackdropFilter: 'blur(32px) saturate(180%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,0.40)' }}>
          <form onSubmit={handleGive} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Amount */}
            <div>
              <label style={labelStyle}>Gift Amount</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 10 }}>
                {PRESET_AMOUNTS.map(p => (
                  <button key={p} type="button"
                    onClick={() => { setPreset(p); setCustomAmount('') }}
                    style={{
                      padding: '10px 0', borderRadius: 12, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: preset === p ? 'rgba(52,211,153,0.18)' : 'rgba(255,255,255,0.06)',
                      color: preset === p ? '#34d399' : 'rgba(255,255,255,0.60)',
                      boxShadow: preset === p ? '0 0 0 1.5px rgba(52,211,153,0.40)' : '0 0 0 1px rgba(255,255,255,0.08)',
                      transition: 'all 0.12s ease',
                    }}
                  >${p}</button>
                ))}
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'rgba(255,255,255,0.40)', pointerEvents: 'none' }}>$</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Other amount"
                  value={customAmount}
                  onChange={e => { setCustomAmount(e.target.value); setPreset(null) }}
                  style={{ ...inputStyle, paddingLeft: 26 }}
                />
              </div>
            </div>

            {/* Fund */}
            <div>
              <label style={labelStyle}>Fund</label>
              <select value={fund} onChange={e => setFund(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', colorScheme: 'dark' }}>
                {FUNDS.map(f => <option key={f} value={f} style={{ background: '#0a0e23' }}>{f}</option>)}
              </select>
            </div>

            {/* Name & Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Your Name *</label>
                <input placeholder="First Last" value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email <span style={{ color: 'rgba(255,255,255,0.25)', textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>(optional, for receipt)</span></label>
                <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
              </div>
            </div>

            {error && <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{error}</p>}

            <button type="submit" disabled={loading || !amount}
              style={{
                padding: '15px 0', borderRadius: 14, fontSize: 15, fontWeight: 700, border: 'none',
                cursor: loading || !amount ? 'not-allowed' : 'pointer',
                background: amount ? 'linear-gradient(135deg, #34d399 0%, #10b981 100%)' : 'rgba(255,255,255,0.08)',
                color: amount ? '#fff' : 'rgba(255,255,255,0.30)',
                boxShadow: amount ? '0 6px 20px rgba(52,211,153,0.35)' : 'none',
                transition: 'all 0.15s ease',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Redirecting…' : amount ? `Give $${amount % 1 === 0 ? amount : amount.toFixed(2)} Securely` : 'Give Securely'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Lock style={{ width: 11, height: 11, color: 'rgba(255,255,255,0.22)' }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)' }}>Secured by Stripe · Your info is never stored on our servers</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Key, Copy, Check, RefreshCw, Clock } from 'lucide-react'

export default function TeamPage() {
  const params = useParams()
  const slug = params.slug as string

  const [keyData, setKeyData] = useState<{ key: string; minutesLeft: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  function fetchKey() {
    setLoading(true)
    fetch(`/api/churches/${slug}/access-key`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setKeyData({ key: d.key, minutesLeft: d.minutesLeft })
      })
      .catch(() => setError('Failed to load access key'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchKey() }, [slug])

  // Countdown timer
  useEffect(() => {
    if (!keyData) return
    const interval = setInterval(() => {
      setKeyData(prev => {
        if (!prev) return prev
        const next = prev.minutesLeft - 1
        if (next <= 0) { fetchKey(); return prev }
        return { ...prev, minutesLeft: next }
      })
    }, 60000)
    return () => clearInterval(interval)
  }, [keyData?.key])

  async function regenerate() {
    setRegenerating(true)
    try {
      const res = await fetch(`/api/churches/${slug}/access-key`, { method: 'POST' })
      const d = await res.json()
      if (d.error) { setError(d.error); return }
      setKeyData({ key: d.key, minutesLeft: d.minutesLeft })
    } finally {
      setRegenerating(false)
    }
  }

  function copyKey() {
    if (!keyData) return
    navigator.clipboard.writeText(keyData.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const urgency = keyData && keyData.minutesLeft <= 10

  return (
    <div style={{ padding: '28px 32px', maxWidth: 560, fontFamily: 'var(--font-geist-sans, system-ui)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(99,102,241,0.22), rgba(129,140,248,0.12))', border: '1px solid rgba(129,140,248,0.25)' }}>
          <Key style={{ width: 20, height: 20, color: '#818cf8' }} />
        </div>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.92)', margin: 0, letterSpacing: '-0.02em' }}>Church Access Key</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: '2px 0 0' }}>Share this key so members can join your workspace</p>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 12, fontSize: 13, background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.22)' }}>
          {error}
        </div>
      )}

      {/* Key card */}
      <div style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28, marginBottom: 16 }}>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ height: 52, borderRadius: 14, background: 'rgba(255,255,255,0.05)' }} />
            <div style={{ height: 20, width: 160, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }} />
          </div>
        ) : keyData ? (
          <>
            {/* Key display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, padding: '14px 20px', borderRadius: 14, background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.22)', textAlign: 'center' }}>
                <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '0.12em', color: '#a5b4fc', fontFamily: 'monospace' }}>
                  {keyData.key}
                </span>
              </div>
              <button onClick={copyKey}
                style={{ width: 48, height: 48, borderRadius: 12, border: '1px solid rgba(255,255,255,0.10)', background: copied ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s ease' }}
                title="Copy key"
              >
                {copied
                  ? <Check style={{ width: 16, height: 16, color: '#34d399' }} />
                  : <Copy style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.50)' }} />
                }
              </button>
            </div>

            {/* Timer + regenerate */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock style={{ width: 13, height: 13, color: urgency ? '#f59e0b' : 'rgba(255,255,255,0.30)' }} />
                <span style={{ fontSize: 12, color: urgency ? '#f59e0b' : 'rgba(255,255,255,0.35)' }}>
                  {keyData.minutesLeft <= 1 ? 'Rotating soon…' : `Rotates in ${keyData.minutesLeft} min`}
                </span>
              </div>
              <button onClick={regenerate} disabled={regenerating}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', cursor: regenerating ? 'not-allowed' : 'pointer', opacity: regenerating ? 0.6 : 1, transition: 'all 0.15s ease' }}
              >
                <RefreshCw style={{ width: 12, height: 12, animation: regenerating ? 'spin 0.8s linear infinite' : 'none' }} />
                {regenerating ? 'Rotating…' : 'Rotate now'}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {/* How it works */}
      <div style={{ padding: '16px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 12px' }}>How it works</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            'Share this key with your team via text, announcement, or QR code.',
            'They create an account on the signup page, then enter this key to join.',
            'The key rotates every hour — old keys stop working automatically.',
            'Rotate manually any time if you think a key has been shared too widely.',
          ].map((text, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#818cf8', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)', lineHeight: 1.5 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

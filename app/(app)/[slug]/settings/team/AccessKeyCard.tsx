'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Check, RefreshCw, Clock } from 'lucide-react'

interface KeyData {
  key: string
  minutesLeft: number
}

export function AccessKeyCard({ slug }: { slug: string }) {
  const [keyData, setKeyData] = useState<KeyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  // Stable fetcher — does NOT call setState synchronously in the effect body;
  // the awaits push state updates out of the render cycle.
  const fetchKey = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/churches/${slug}/access-key`, { signal })
      const d = await res.json()
      if (signal?.aborted) return
      if (d.error) { setError(d.error); return }
      setKeyData({ key: d.key, minutesLeft: d.minutesLeft })
      setError('')
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return
      setError('Failed to load access key')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [slug])

  // Initial fetch + slug change. We don't reset `loading` to true here because
  // useState already starts at true on mount, and the slug is URL-derived (it
  // doesn't change within a session). If that ever changes, do it inside an
  // event handler rather than synchronously in the effect body.
  useEffect(() => {
    const ctrl = new AbortController()
    void fetchKey(ctrl.signal)
    return () => ctrl.abort()
  }, [fetchKey])

  // One interval, set up once. Uses functional setState so we never go stale,
  // so there's no need for a ref. When the local countdown reaches zero we
  // refetch — the server will rotate if it's actually expired.
  useEffect(() => {
    const id = setInterval(() => {
      setKeyData(curr => {
        if (!curr) return curr
        if (curr.minutesLeft <= 1) {
          void fetchKey()
          return curr
        }
        return { ...curr, minutesLeft: curr.minutesLeft - 1 }
      })
    }, 60_000)
    return () => clearInterval(id)
  }, [fetchKey])

  async function regenerate() {
    setRegenerating(true)
    try {
      const res = await fetch(`/api/churches/${slug}/access-key`, { method: 'POST' })
      const d = await res.json()
      if (d.error) { setError(d.error); return }
      setKeyData({ key: d.key, minutesLeft: d.minutesLeft })
      setError('')
    } catch {
      setError('Failed to rotate key')
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
    <div style={{ marginBottom: 24 }}>
      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, fontSize: 13, background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.22)' }}>
          {error}
        </div>
      )}

      <div style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, marginBottom: 12 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ height: 52, borderRadius: 14, background: 'rgba(255,255,255,0.05)' }} />
            <div style={{ height: 20, width: 160, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }} />
          </div>
        ) : keyData ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{ flex: 1, padding: '13px 18px', borderRadius: 14, background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.22)', textAlign: 'center' }}>
                <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '0.12em', color: '#a5b4fc', fontFamily: 'monospace' }}>
                  {keyData.key}
                </span>
              </div>
              <button
                onClick={copyKey}
                style={{ width: 46, height: 46, borderRadius: 12, border: '1px solid rgba(255,255,255,0.10)', background: copied ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s ease' }}
              >
                {copied ? <Check style={{ width: 16, height: 16, color: '#34d399' }} /> : <Copy style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.50)' }} />}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock style={{ width: 13, height: 13, color: urgency ? '#f59e0b' : 'rgba(255,255,255,0.30)' }} />
                <span style={{ fontSize: 12, color: urgency ? '#f59e0b' : 'rgba(255,255,255,0.35)' }}>
                  {keyData.minutesLeft <= 1 ? 'Rotating soon…' : `Rotates in ${keyData.minutesLeft} min`}
                </span>
              </div>
              <button
                onClick={regenerate}
                disabled={regenerating}
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
      <div style={{ padding: '14px 18px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>How it works</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'Share this key with your team — they enter it when creating their account.',
            'The key rotates every hour. Old keys stop working automatically.',
            'Rotate manually any time if a key has been shared too widely.',
          ].map((text, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 17, height: 17, borderRadius: 5, background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#818cf8', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

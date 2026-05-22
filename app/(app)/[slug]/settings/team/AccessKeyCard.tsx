'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Check, RefreshCw, Clock } from 'lucide-react'
import { Card, IconButton, Button, Skeleton, Message } from '@/components/ui'

interface KeyData {
  key: string
  minutesLeft: number
}

export function AccessKeyCard({ slug }: { slug: string }) {
  const [keyData, setKeyData] = useState<KeyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [justRotated, setJustRotated] = useState(false)
  const [error, setError] = useState('')

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

  useEffect(() => {
    const ctrl = new AbortController()
    void fetchKey(ctrl.signal)
    return () => ctrl.abort()
  }, [fetchKey])

  // Per-minute countdown. Functional setState so no ref needed.
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
      setJustRotated(true)
      setTimeout(() => setJustRotated(false), 1000)
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && <Message tone="error">{error}</Message>}

      <Card padding={28}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Skeleton height={60} radius={14} />
            <Skeleton height={18} width={180} />
          </div>
        ) : keyData ? (
          <>
            {/* Key display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <div
                style={{
                  flex: 1,
                  padding: '16px 20px',
                  borderRadius: 14,
                  background: 'var(--ds-accent-soft)',
                  border: '1px solid var(--ds-accent-line)',
                  textAlign: 'center',
                  transition: 'transform 0.25s var(--ds-ease-out)',
                  transform: justRotated ? 'scale(1.015)' : 'scale(1)',
                }}
              >
                <span
                  key={keyData.key}
                  className="ds-fade-up"
                  style={{
                    display: 'inline-block',
                    fontSize: 28,
                    fontWeight: 600,
                    letterSpacing: '0.18em',
                    color: 'var(--ds-accent)',
                    fontFamily: 'var(--font-geist-mono), monospace',
                  }}
                >
                  {keyData.key}
                </span>
              </div>
              <IconButton onClick={copyKey} bordered size={48} aria-label="Copy key">
                {copied
                  ? <Check style={{ width: 18, height: 18, color: 'var(--ds-success)' }} />
                  : <Copy style={{ width: 17, height: 17 }} />}
              </IconButton>
            </div>

            {/* Footer: countdown + rotate */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: urgency ? 'var(--ds-warning)' : 'var(--ds-text-tertiary)' }}>
                <Clock style={{ width: 13, height: 13 }} />
                <span style={{ fontSize: 12, fontWeight: 500 }}>
                  {keyData.minutesLeft <= 1 ? 'Rotating soon…' : `Rotates in ${keyData.minutesLeft} min`}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={regenerate}
                loading={regenerating}
                leftIcon={!regenerating ? <RefreshCw style={{ width: 13, height: 13 }} /> : undefined}
              >
                {regenerating ? 'Rotating…' : 'Rotate now'}
              </Button>
            </div>
          </>
        ) : null}
      </Card>

      {/* How it works — quieter card */}
      <Card variant="quiet" padding="16px 18px">
        <p className="ds-label-micro" style={{ marginBottom: 12 }}>How it works</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            'Share this key with your team — they enter it when creating their account.',
            'The key rotates every hour. Old keys stop working automatically.',
            'Rotate manually any time if a key has been shared too widely.',
          ].map((text, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 18, height: 18,
                  borderRadius: 5,
                  background: 'var(--ds-accent-soft)',
                  border: '1px solid var(--ds-accent-line)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 600,
                  color: 'var(--ds-accent)',
                  marginTop: 1,
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 13, color: 'var(--ds-text-secondary)', lineHeight: 1.55 }}>{text}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

interface PremiumGateProps {
  title: string
  subtitle: string
  features: Feature[]
  children: React.ReactNode
}

export default function PremiumGate({ title, subtitle, features, children }: PremiumGateProps) {
  const params = useParams()
  const slug = params?.slug as string
  const [isPaid, setIsPaid] = useState<boolean | null>(null)

  useEffect(() => {
    const url = slug ? `/api/freemium/usage?slug=${slug}` : '/api/freemium/usage'
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(d => setIsPaid(d?.isPaid ?? false))
      .catch(() => setIsPaid(false))
  }, [slug])

  if (isPaid === null) return null
  if (isPaid) return <>{children}</>

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 640 }}>

        {/* Top accent line */}
        <div style={{
          width: 48, height: 2, borderRadius: 99, marginBottom: 40,
          background: 'var(--aq-gold)',
        }} />

        {/* Heading */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '4px 12px', borderRadius: 99, marginBottom: 20,
            background: 'rgba(200,169,107,0.08)',
            border: '0.5px solid var(--aq-border)',
          }}>
            <Zap style={{ width: 11, height: 11, color: 'var(--aq-gold)' }} />
            <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--aq-text-secondary)' }}>
              Premium Feature
            </span>
          </div>
          <h1 style={{
            fontSize: 32, fontWeight: 500, color: 'var(--aq-text-primary)',
            letterSpacing: '-0.04em', lineHeight: 1.1, margin: '0 0 16px',
          }}>
            {title}
          </h1>
          <p style={{
            fontSize: 15, color: 'var(--aq-text-tertiary)',
            lineHeight: 1.65, margin: 0, maxWidth: 480,
          }}>
            {subtitle}
          </p>
        </div>

        {/* Feature grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, marginBottom: 48, borderRadius: 20, overflow: 'hidden', border: '0.5px solid var(--aq-border)' }}>
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <div key={i} style={{
                padding: '24px 26px',
                background: i % 2 === 0 ? 'var(--aq-surface)' : 'var(--aq-elevated)',
                borderRight: i % 2 === 0 ? '0.5px solid var(--aq-border)' : 'none',
                borderBottom: i < features.length - 2 ? '0.5px solid var(--aq-border)' : 'none',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, marginBottom: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(200,169,107,0.10)',
                  border: '0.5px solid var(--aq-border)',
                }}>
                  <Icon style={{ width: 15, height: 15, color: 'var(--aq-gold)' }} />
                </div>
                <p style={{
                  fontSize: 13, fontWeight: 500, color: 'var(--aq-text-primary)',
                  margin: '0 0 5px', letterSpacing: '-0.015em',
                }}>
                  {f.title}
                </p>
                <p style={{
                  fontSize: 12, color: 'var(--aq-text-tertiary)',
                  margin: 0, lineHeight: 1.55,
                }}>
                  {f.description}
                </p>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link
            href={`/${slug}/pricing`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              padding: '11px 24px', borderRadius: 12,
              background: 'var(--aq-gold)',
              fontSize: 13, fontWeight: 500, color: '#fff',
              textDecoration: 'none', letterSpacing: '-0.01em',
            }}
          >
            <Zap style={{ width: 14, height: 14 }} />
            Upgrade to unlock
          </Link>
          <span style={{ fontSize: 12, color: 'var(--aq-text-muted)' }}>
            Starter from $49 / mo · cancel anytime
          </span>
        </div>

      </div>
    </div>
  )
}

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
    fetch('/api/freemium/usage')
      .then(r => r.ok ? r.json() : null)
      .then(d => setIsPaid(d?.isPaid ?? false))
      .catch(() => setIsPaid(false))
  }, [])

  if (isPaid === null) return null
  if (isPaid) return <>{children}</>

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 640 }}>

        {/* Top accent line */}
        <div style={{
          width: 48, height: 2, borderRadius: 99, marginBottom: 40,
          background: 'linear-gradient(90deg, #A88A35, #C9A84C)',
          boxShadow: '0 0 16px rgba(201,168,76,0.40)',
        }} />

        {/* Heading */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '4px 12px', borderRadius: 99, marginBottom: 20,
            background: 'rgba(201,168,76,0.08)',
            border: '1px solid rgba(201,168,76,0.18)',
          }}>
            <Zap style={{ width: 11, height: 11, color: '#C9A84C' }} />
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.75)' }}>
              Premium Feature
            </span>
          </div>
          <h1 style={{
            fontSize: 32, fontWeight: 700, color: 'rgba(255,255,255,0.92)',
            letterSpacing: '-0.04em', lineHeight: 1.1, margin: '0 0 16px',
          }}>
            {title}
          </h1>
          <p style={{
            fontSize: 15, color: 'rgba(255,255,255,0.40)',
            lineHeight: 1.65, margin: 0, maxWidth: 480,
          }}>
            {subtitle}
          </p>
        </div>

        {/* Feature grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, marginBottom: 48, borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <div key={i} style={{
                padding: '24px 26px',
                background: i % 2 === 0
                  ? 'linear-gradient(145deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.012) 100%)'
                  : 'linear-gradient(145deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.008) 100%)',
                borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                borderBottom: i < features.length - 2 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, marginBottom: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(201,168,76,0.10)',
                  border: '1px solid rgba(201,168,76,0.18)',
                }}>
                  <Icon style={{ width: 15, height: 15, color: '#C9A84C' }} />
                </div>
                <p style={{
                  fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.82)',
                  margin: '0 0 5px', letterSpacing: '-0.015em',
                }}>
                  {f.title}
                </p>
                <p style={{
                  fontSize: 12, color: 'rgba(255,255,255,0.32)',
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
              background: 'linear-gradient(135deg, #A88A35 0%, #C9A84C 100%)',
              boxShadow: '0 4px 20px rgba(201,168,76,0.28)',
              fontSize: 13, fontWeight: 600, color: '#fff',
              textDecoration: 'none', letterSpacing: '-0.01em',
            }}
          >
            <Zap style={{ width: 14, height: 14 }} />
            Upgrade to unlock
          </Link>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.20)' }}>
            Starter from $49 / mo · cancel anytime
          </span>
        </div>

      </div>
    </div>
  )
}

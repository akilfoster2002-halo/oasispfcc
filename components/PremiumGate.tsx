'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Lock, Zap } from 'lucide-react'

interface Feature {
  icon: string
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

  // Still loading — render nothing to avoid flash
  if (isPaid === null) return null

  // Paid plan — show the real page
  if (isPaid) return <>{children}</>

  // Free plan — show the gate
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '64px 24px' }}>

      {/* Lock badge */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(201,168,76,0.14) 0%, rgba(201,168,76,0.06) 100%)',
          border: '1px solid rgba(201,168,76,0.22)',
          boxShadow: '0 0 32px rgba(201,168,76,0.08)',
        }}>
          <Lock style={{ width: 22, height: 22, color: '#C9A84C' }} />
        </div>
      </div>

      {/* Heading */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{
          fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.92)',
          letterSpacing: '-0.03em', margin: '0 0 10px',
        }}>
          {title}
        </h1>
        <p style={{
          fontSize: 14, color: 'rgba(255,255,255,0.42)',
          lineHeight: 1.6, margin: 0, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto',
        }}>
          {subtitle}
        </p>
      </div>

      {/* Feature previews */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12, marginBottom: 36,
      }}>
        {features.map((f, i) => (
          <div key={i} style={{
            padding: '18px 20px', borderRadius: 16,
            background: 'linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
            <p style={{
              fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.80)',
              margin: '0 0 4px', letterSpacing: '-0.01em',
            }}>
              {f.title}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0, lineHeight: 1.5 }}>
              {f.description}
            </p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Link
          href={`/${slug}/pricing`}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 28px', borderRadius: 14,
            background: 'linear-gradient(135deg, #A88A35 0%, #C9A84C 100%)',
            boxShadow: '0 4px 20px rgba(201,168,76,0.30)',
            fontSize: 14, fontWeight: 600, color: '#fff',
            textDecoration: 'none', letterSpacing: '-0.01em',
          }}
        >
          <Zap style={{ width: 15, height: 15 }} />
          Upgrade to unlock
        </Link>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.24)', margin: 0 }}>
          Starter plan from $49/mo · cancel anytime
        </p>
      </div>

    </div>
  )
}

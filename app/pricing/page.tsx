'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ArrowRight, Sparkles, Zap } from 'lucide-react'

function AquilaMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <radialGradient id="pm-bg" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#3730a3" />
        </radialGradient>
        <radialGradient id="pm-iris" cx="40%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.85" />
        </radialGradient>
        <filter id="pm-glow">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#pm-bg)" />
      <rect x="0" y="0" width="32" height="14" rx="9" fill="rgba(255,255,255,0.09)" />
      <circle cx="16" cy="16" r="7.5" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      <circle cx="16" cy="16" r="4" fill="url(#pm-iris)" filter="url(#pm-glow)" />
      <circle cx="13.6" cy="13.6" r="1.1" fill="rgba(255,255,255,0.60)" />
    </svg>
  )
}

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    tagline: 'Organize your ministry',
    description: 'Church plants · Small churches · Under 150 people',
    aiResponses: '~25 responses / mo',
    popular: false,
    features: [
      'Member management',
      'Attendance tracking',
      'Engagement overview',
      'Basic follow-up workflows',
      'Volunteer management',
      'Simple dashboards',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 149,
    tagline: 'Understand your church',
    description: 'Growing churches · Multi-ministry teams',
    aiResponses: '~100 responses / mo',
    popular: true,
    features: [
      'Everything in Starter',
      'Advanced ministry dashboards',
      'Custom workflows',
      'Automated follow-up',
      'Engagement trends',
      'Volunteer health tracking',
      'Advanced reporting',
      'Integrations',
    ],
  },
  {
    id: 'intelligence',
    name: 'Intelligence',
    price: 349,
    tagline: 'Lead with clarity',
    description: 'Established churches · Senior leadership',
    aiResponses: 'Unlimited responses',
    popular: false,
    features: [
      'Everything in Growth',
      'Predictive engagement',
      'Pastoral care alerts',
      'Disengagement detection',
      'Ministry health scoring',
      'Leadership summaries',
      'Church health reports',
      'Executive dashboards',
    ],
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleSelect(planId: string) {
    setLoading(planId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401) { router.push('/login?next=/pricing'); return }
        alert(data.error ?? 'Something went wrong')
        return
      }
      window.location.href = data.url
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#050810',
      fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)',
      WebkitFontSmoothing: 'antialiased',
      color: 'rgba(255,255,255,0.88)',
    }}>
      {/* Navbar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(5,8,16,0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.055)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <AquilaMark size={30} />
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.94)', margin: 0, lineHeight: 1, fontFamily: 'var(--font-display, var(--font-geist-sans))' }}>Aquila</p>
              <p style={{ fontSize: 10, color: 'rgba(129,140,248,0.50)', letterSpacing: '0.07em', fontWeight: 500, margin: '3px 0 0', textTransform: 'uppercase' }}>by Oasis PFCC</p>
            </div>
          </Link>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/login" style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>Sign in</Link>
            <Link href="/signup" style={{ padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff', textDecoration: 'none', boxShadow: '0 4px 14px rgba(99,102,241,0.30)' }}>Get started</Link>
          </div>
        </div>
      </header>

      {/* Header */}
      <div style={{ position: 'relative', overflow: 'hidden', padding: '80px 24px 64px', textAlign: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -100, left: '50%', width: 700, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 65%)', transform: 'translateX(-50%)' }} />
        </div>

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 100, marginBottom: 24, background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(129,140,248,0.22)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#a5b4fc' }}>
            <Sparkles style={{ width: 11, height: 11 }} />
            Pricing
          </div>
          <h1 style={{ fontFamily: 'var(--font-display, var(--font-geist-sans))', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, letterSpacing: '-0.035em', color: 'rgba(255,255,255,0.96)', margin: '0 0 16px', lineHeight: 1.05 }}>
            Ministry intelligence,<br />not church software.
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.40)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
            AI included on every plan — deeper access unlocks as you grow.
          </p>
        </div>
      </div>

      {/* Plans */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
          {PLANS.map(plan => (
            <div
              key={plan.id}
              style={{
                borderRadius: 24,
                padding: '28px 26px 32px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                background: plan.popular
                  ? 'linear-gradient(145deg, rgba(99,102,241,0.16) 0%, rgba(55,48,163,0.10) 100%)'
                  : 'linear-gradient(145deg, rgba(255,255,255,0.048) 0%, rgba(255,255,255,0.016) 100%)',
                border: plan.popular
                  ? '1px solid rgba(129,140,248,0.40)'
                  : '1px solid rgba(255,255,255,0.065)',
                boxShadow: plan.popular ? '0 0 40px rgba(99,102,241,0.12)' : 'none',
              }}
            >
              {plan.popular && (
                <div style={{
                  position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                  padding: '4px 16px', borderRadius: 100,
                  background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: '#fff', whiteSpace: 'nowrap',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.45)',
                }}>
                  Most Popular
                </div>
              )}

              {/* Plan name & price */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 10px' }}>
                  {plan.name}
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                  <span style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-0.04em', color: 'rgba(255,255,255,0.95)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                    ${plan.price}
                  </span>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>/mo</span>
                </div>
                <p style={{ fontSize: 14, fontStyle: 'italic', color: plan.popular ? '#a5b4fc' : 'rgba(255,255,255,0.50)', margin: '0 0 4px' }}>
                  {plan.tagline}
                </p>
              </div>

              {/* AI badge */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 12, marginBottom: 22,
                background: plan.popular ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)',
                border: `1px solid ${plan.popular ? 'rgba(129,140,248,0.35)' : 'rgba(129,140,248,0.18)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Zap style={{ width: 14, height: 14, color: '#818cf8' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#818cf8' }}>AI Congregation Agent</span>
                </div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{plan.aiResponses}</span>
              </div>

              {/* Features */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: plan.popular ? 'rgba(129,140,248,0.20)' : 'rgba(255,255,255,0.07)', marginTop: 1 }}>
                      <Check style={{ width: 10, height: 10, color: plan.popular ? '#a5b4fc' : 'rgba(255,255,255,0.50)' }} />
                    </div>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => handleSelect(plan.id)}
                disabled={loading !== null}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 13,
                  fontSize: 14, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'opacity 0.15s',
                  opacity: loading && loading !== plan.id ? 0.5 : 1,
                  background: plan.popular
                    ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)'
                    : 'rgba(255,255,255,0.08)',
                  color: plan.popular ? '#fff' : 'rgba(255,255,255,0.70)',
                  boxShadow: plan.popular ? '0 6px 24px rgba(99,102,241,0.40)' : 'none',
                }}
              >
                {loading === plan.id ? 'Redirecting…' : <>Get started <ArrowRight style={{ width: 14, height: 14 }} /></>}
              </button>

              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', margin: '12px 0 0' }}>
                {plan.description}
              </p>
            </div>
          ))}
        </div>

        {/* Enterprise row */}
        <div style={{
          marginTop: 16,
          padding: '24px 28px',
          borderRadius: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.065)',
        }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.88)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
              Multi-Campus / Enterprise
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: 0 }}>
              Large churches, networks, denominations — custom onboarding, API access, dedicated support, white-glove migration.
            </p>
            <p style={{ fontSize: 12, fontStyle: 'italic', color: 'rgba(255,255,255,0.28)', margin: '4px 0 0' }}>
              Infrastructure for your network
            </p>
          </div>
          <a
            href="mailto:hello@aquila.church"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 24px', borderRadius: 12,
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.75)',
              whiteSpace: 'nowrap',
            }}
          >
            Contact us <ArrowRight style={{ width: 13, height: 13 }} />
          </a>
        </div>

        {/* Trust line */}
        <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.22)', marginTop: 32 }}>
          Billed monthly · Cancel anytime · Secure payments via Stripe
        </p>
      </div>
    </div>
  )
}

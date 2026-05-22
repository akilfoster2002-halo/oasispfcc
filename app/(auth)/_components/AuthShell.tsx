'use client'

import { type ReactNode } from 'react'

// ── Large iris mark — rendered big for the brand panel ────────────────────────

export function AquilaIris({ size = 160 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" fill="none" aria-hidden>
      <defs>
        <radialGradient id="iris-bg" cx="38%" cy="28%" r="78%">
          <stop offset="0%"   stopColor="#162040" />
          <stop offset="100%" stopColor="#0A1228" />
        </radialGradient>
        <radialGradient id="iris-gold" cx="38%" cy="36%" r="68%">
          <stop offset="0%"   stopColor="#DDB95A" stopOpacity="1"    />
          <stop offset="55%"  stopColor="#C9A84C" stopOpacity="0.90" />
          <stop offset="100%" stopColor="#8A6820" stopOpacity="0.70" />
        </radialGradient>
        <radialGradient id="iris-ring" cx="50%" cy="50%" r="50%">
          <stop offset="70%"  stopColor="rgba(201,168,76,0)"  />
          <stop offset="100%" stopColor="rgba(201,168,76,0.22)" />
        </radialGradient>
        <radialGradient id="iris-glow-center" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(221,185,90,0.35)" />
          <stop offset="100%" stopColor="rgba(201,168,76,0)"   />
        </radialGradient>
        <filter id="iris-blur-lg" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id="iris-blur-sm" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="iris-specular" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outermost ambient glow */}
      <circle cx="80" cy="80" r="72" fill="url(#iris-glow-center)" filter="url(#iris-blur-lg)" />

      {/* Orbit rings */}
      <circle cx="80" cy="80" r="68" stroke="rgba(201,168,76,0.07)"  strokeWidth="1" fill="none" />
      <circle cx="80" cy="80" r="58" stroke="rgba(201,168,76,0.10)"  strokeWidth="0.5" fill="none" />
      <circle cx="80" cy="80" r="48" stroke="rgba(201,168,76,0.14)"  strokeWidth="1"   fill="none" />
      <circle cx="80" cy="80" r="36" stroke="rgba(201,168,76,0.20)"  strokeWidth="0.5" fill="none" />

      {/* Base disc */}
      <circle cx="80" cy="80" r="28" fill="url(#iris-bg)" />

      {/* Frosted top highlight */}
      <ellipse cx="80" cy="68" rx="20" ry="10" fill="rgba(255,252,245,0.06)" />

      {/* Iris core */}
      <circle cx="80" cy="80" r="20" fill="url(#iris-gold)" filter="url(#iris-blur-sm)" />

      {/* Pupil */}
      <circle cx="80" cy="80" r="8" fill="rgba(4,6,14,0.85)" />

      {/* Inner iris detail — radial spokes */}
      {[0,30,60,90,120,150,180,210,240,270,300,330].map(angle => (
        <line
          key={angle}
          x1="80" y1="80"
          x2={80 + Math.cos(angle * Math.PI / 180) * 20}
          y2={80 + Math.sin(angle * Math.PI / 180) * 20}
          stroke="rgba(201,168,76,0.18)"
          strokeWidth="0.5"
        />
      ))}

      {/* Specular highlight */}
      <circle cx="73" cy="73" r="4.5" fill="rgba(255,248,215,0.70)" filter="url(#iris-specular)" />
      <circle cx="71" cy="71" r="2"   fill="rgba(255,255,240,0.90)" />

      {/* Bottom warm glow */}
      <ellipse cx="80" cy="140" rx="50" ry="14" fill="rgba(201,168,76,0.06)" />
    </svg>
  )
}

// ── Small mark — compact version for inline use ───────────────────────────────

export function AquilaMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <radialGradient id="aqm-bg" cx="38%" cy="28%" r="78%">
          <stop offset="0%"   stopColor="#1B2E5A" />
          <stop offset="100%" stopColor="#0C1835" />
        </radialGradient>
        <radialGradient id="aqm-iris" cx="38%" cy="36%" r="68%">
          <stop offset="0%"   stopColor="#C9A84C" stopOpacity="0.95" />
          <stop offset="60%"  stopColor="#A88A35" stopOpacity="0.82" />
          <stop offset="100%" stopColor="#7B6220" stopOpacity="0.65" />
        </radialGradient>
        <filter id="aqm-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#aqm-bg)" />
      <rect x="0" y="0" width="32" height="13" rx="9" fill="rgba(255,252,245,0.07)" />
      <rect x="0" y="6"  width="32" height="7"  fill="rgba(0,0,0,0)" />
      <circle cx="16" cy="16" r="7.5" stroke="rgba(201,168,76,0.28)" strokeWidth="1" />
      <circle cx="16" cy="16" r="4.2" fill="url(#aqm-iris)" filter="url(#aqm-glow)" />
      <circle cx="13.8" cy="13.5" r="1.1" fill="rgba(255,248,220,0.65)" />
      <ellipse cx="16" cy="28" rx="10" ry="3" fill="rgba(201,168,76,0.05)" />
    </svg>
  )
}

// ── Auth input helpers ────────────────────────────────────────────────────────

export const authStyles = {
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 12,
    fontSize: 14,
    outline: 'none',
    background: 'rgba(255,255,255,0.036)',
    border: '1px solid rgba(255,255,255,0.082)',
    color: 'rgba(255,248,225,0.88)',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    boxSizing: 'border-box' as const,
    letterSpacing: '-0.005em',
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    marginBottom: 7,
    color: 'rgba(255,248,225,0.50)',
    letterSpacing: '-0.003em',
  } as React.CSSProperties,
}

export function inputFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'rgba(201,168,76,0.45)'
  e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(201,168,76,0.10)'
}
export function inputBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.082)'
  e.currentTarget.style.boxShadow   = 'none'
}

// ── Shell ─────────────────────────────────────────────────────────────────────

interface AuthShellProps {
  title: string
  subtitle?: string
  error?: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthShell({ title, subtitle, error, children, footer }: AuthShellProps) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: '#06070E',
    }}>

      {/* ── LEFT — brand panel (desktop only) ── */}
      <div
        className="hidden md:flex"
        style={{
          width: 420,
          flexShrink: 0,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(165deg, #0D1829 0%, #080F1C 45%, #050A14 100%)',
          borderRight: '1px solid rgba(201,168,76,0.08)',
        }}
      >
        {/* Atmospheric gold glow — rises from center */}
        <div style={{
          position: 'absolute',
          bottom: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 500,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(201,168,76,0.10) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Top-right platinum mist */}
        <div style={{
          position: 'absolute',
          top: '-5%',
          right: '-15%',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(160,185,220,0.06) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        {/* Decorative vertical line — left edge */}
        <div style={{
          position: 'absolute',
          left: 40,
          top: '15%',
          bottom: '15%',
          width: 1,
          background: 'linear-gradient(180deg, transparent, rgba(201,168,76,0.15) 30%, rgba(201,168,76,0.15) 70%, transparent)',
        }} />

        {/* Content */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '0 48px',
          gap: 0,
        }}>

          {/* Large iris */}
          <div style={{ marginBottom: 36, position: 'relative' }}>
            <AquilaIris size={148} />
          </div>

          {/* Wordmark */}
          <p style={{
            fontFamily: 'var(--font-cormorant, "Cormorant Garamond"), Georgia, serif',
            fontSize: 48,
            fontWeight: 300,
            letterSpacing: '0.08em',
            color: 'rgba(255,248,225,0.94)',
            margin: '0 0 12px',
            lineHeight: 1,
          }}>
            Aquila
          </p>

          {/* Gold rule */}
          <div style={{
            width: 48,
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.50), transparent)',
            marginBottom: 20,
          }} />

          {/* Org tag */}
          <p style={{
            fontSize: 9,
            color: 'rgba(201,168,76,0.50)',
            letterSpacing: '0.22em',
            fontWeight: 600,
            textTransform: 'uppercase',
            margin: '0 0 40px',
          }}>
            By Oasis PFCC
          </p>

          {/* Tagline */}
          <p style={{
            fontFamily: 'var(--font-cormorant, "Cormorant Garamond"), Georgia, serif',
            fontSize: 20,
            fontWeight: 400,
            fontStyle: 'italic',
            color: 'rgba(255,248,225,0.36)',
            lineHeight: 1.6,
            maxWidth: 280,
            margin: 0,
            letterSpacing: '0.01em',
          }}>
            See your church clearly.
          </p>

          {/* Bottom decorative dots */}
          <div style={{
            display: 'flex',
            gap: 8,
            marginTop: 48,
            alignItems: 'center',
          }}>
            {[0.40, 0.18, 0.08].map((opacity, i) => (
              <div key={i} style={{
                width: i === 0 ? 20 : 6,
                height: 1,
                background: `rgba(201,168,76,${opacity})`,
                borderRadius: 99,
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT — form panel ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        overflowY: 'auto',
        position: 'relative',
      }}>

        {/* Subtle background atmosphere on form side */}
        <div style={{
          position: 'fixed',
          top: 0, left: 420, right: 0, bottom: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 80% 50% at 60% 80%, rgba(201,168,76,0.022) 0%, transparent 55%), ' +
            'radial-gradient(ellipse 60% 60% at 90% 10%, rgba(79,127,196,0.015) 0%, transparent 55%)',
        }} />

        {/* Mobile brand mark */}
        <div className="flex md:hidden" style={{
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          marginBottom: 40,
        }}>
          <AquilaMark size={44} />
          <div style={{ textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-cormorant, "Cormorant Garamond"), Georgia, serif',
              fontSize: 26,
              fontWeight: 300,
              letterSpacing: '0.06em',
              color: 'rgba(255,248,225,0.94)',
              margin: '0 0 4px',
            }}>
              Aquila
            </p>
            <p style={{
              fontSize: 8,
              color: 'rgba(201,168,76,0.45)',
              letterSpacing: '0.18em',
              fontWeight: 600,
              textTransform: 'uppercase',
              margin: 0,
            }}>
              By Oasis PFCC
            </p>
          </div>
        </div>

        {/* Card */}
        <div
          className="aq-rise"
          style={{
            width: '100%',
            maxWidth: 400,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{
              fontFamily: 'var(--font-cormorant, "Cormorant Garamond"), Georgia, serif',
              fontSize: 34,
              fontWeight: 400,
              letterSpacing: '0.01em',
              color: 'rgba(255,248,225,0.95)',
              margin: '0 0 10px',
              lineHeight: 1.1,
            }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{
                fontSize: 14,
                color: 'rgba(255,248,225,0.38)',
                margin: 0,
                lineHeight: 1.6,
                letterSpacing: '-0.003em',
              }}>
                {subtitle}
              </p>
            )}
            {/* Gold rule */}
            <div style={{
              height: 1,
              marginTop: 24,
              background: 'linear-gradient(90deg, rgba(201,168,76,0.30), rgba(201,168,76,0.08) 60%, transparent)',
            }} />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: 20,
              padding: '11px 14px',
              borderRadius: 12,
              fontSize: 13,
              background: 'rgba(241,117,117,0.07)',
              color: '#f17575',
              border: '1px solid rgba(241,117,117,0.18)',
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          {children}
          {footer}
        </div>
      </div>
    </div>
  )
}

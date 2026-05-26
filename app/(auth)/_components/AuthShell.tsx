'use client'

import Image from 'next/image'
import { type ReactNode } from 'react'

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

          {/* Logo */}
          <div style={{ marginBottom: 36, position: 'relative' }}>
            <Image src="/Aquila Logo.png" width={148} height={148} alt="Aquila" />
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
          <Image src="/Aquila Logo.png" width={44} height={44} alt="Aquila" />
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

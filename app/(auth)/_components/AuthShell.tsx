'use client'

import { type CSSProperties, type FocusEvent, type ReactNode } from 'react'

// ─── Brand mark ───────────────────────────────────────────────────────────────
// Single source of truth. Only one auth page is rendered at a time so the
// hard-coded SVG ids don't collide.

export function AquilaMark() {
  return (
    <svg width="38" height="38" viewBox="0 0 32 32" fill="none">
      <defs>
        <radialGradient id="aquila-bg" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#3730a3" />
        </radialGradient>
        <radialGradient id="aquila-iris" cx="40%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.85" />
        </radialGradient>
        <filter id="aquila-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#aquila-bg)" />
      <rect x="0" y="0" width="32" height="14" rx="9" fill="rgba(255,255,255,0.10)" />
      <circle cx="16" cy="16" r="7" stroke="rgba(255,255,255,0.20)" strokeWidth="1" />
      <circle cx="16" cy="16" r="4" fill="url(#aquila-iris)" filter="url(#aquila-glow)" />
      <circle cx="13.5" cy="13.5" r="1.2" fill="rgba(255,255,255,0.55)" />
    </svg>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

export const authStyles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    background: '#050810',
    backgroundImage:
      'radial-gradient(ellipse 70% 60% at 20% 0%, rgba(79,70,229,0.15) 0%, transparent 65%), radial-gradient(ellipse 55% 45% at 80% 100%, rgba(124,58,237,0.09) 0%, transparent 65%)',
    fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)',
    WebkitFontSmoothing: 'antialiased',
  } as CSSProperties,

  card: {
    width: '100%',
    maxWidth: 380,
    background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)',
    backdropFilter: 'blur(32px) saturate(180%)',
    WebkitBackdropFilter: 'blur(32px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.065)',
    borderRadius: 24,
    boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 24px 64px rgba(0,0,0,0.45)',
    padding: '32px 28px',
  } as CSSProperties,

  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 12,
    fontSize: 14,
    outline: 'none',
    background: 'rgba(255,255,255,0.040)',
    border: '1px solid rgba(255,255,255,0.090)',
    color: 'rgba(255,255,255,0.88)',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    boxSizing: 'border-box',
  } as CSSProperties,

  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    marginBottom: 6,
    color: 'rgba(255,255,255,0.50)',
  } as CSSProperties,

  errorBox: {
    marginBottom: 16,
    padding: '10px 14px',
    borderRadius: 12,
    fontSize: 13,
    background: 'rgba(248,113,113,0.10)',
    color: '#f87171',
    border: '1px solid rgba(248,113,113,0.22)',
    lineHeight: 1.5,
  } as CSSProperties,
}

// ─── Focus handlers (highlight border on focus) ───────────────────────────────

export function inputFocus(e: FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'rgba(99,102,241,0.55)'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'
}
export function inputBlur(e: FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.090)'
  e.currentTarget.style.boxShadow = 'none'
}

// ─── Shell ────────────────────────────────────────────────────────────────────

interface AuthShellProps {
  title: string
  subtitle?: string
  error?: string
  children: ReactNode
  /** Optional content rendered below the card (e.g. "Already have an account?"). */
  footer?: ReactNode
}

export function AuthShell({ title, subtitle, error, children, footer }: AuthShellProps) {
  return (
    <div style={authStyles.wrap}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 36 }}>
        <div style={{ position: 'relative' }}>
          <AquilaMark />
          <div
            style={{
              position: 'absolute',
              inset: -8,
              borderRadius: 20,
              background: 'radial-gradient(circle, rgba(99,102,241,0.20) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.025em',
              color: 'rgba(255,255,255,0.94)',
              margin: 0,
              lineHeight: 1,
            }}
          >
            Aquila
          </p>
          <p style={{ fontSize: 11, color: 'rgba(129,140,248,0.52)', letterSpacing: '0.08em', fontWeight: 500, margin: '4px 0 0' }}>
            BY OASIS PFCC
          </p>
        </div>
      </div>

      <div style={authStyles.card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.020em',
              color: 'rgba(255,255,255,0.94)',
              margin: '0 0 6px',
              fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui',
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: 0 }}>{subtitle}</p>
          )}
        </div>

        {error && <div style={authStyles.errorBox}>{error}</div>}

        {children}

        {footer}
      </div>
    </div>
  )
}

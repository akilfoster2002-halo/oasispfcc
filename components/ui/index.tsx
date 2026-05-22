'use client'

/**
 * Design-system primitives (v2 — calm / premium).
 *
 * These wrap the `.ds-*` classes in `globals.css` so callers don't have to
 * remember class names or compose them by hand. Use them on new surfaces.
 * Older `.glass-*` / `.btn-primary` pages still work as-is.
 */

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode } from 'react'

function cx(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(' ')
}

// ─── Card ────────────────────────────────────────────────────────────────────

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'quiet'
  padding?: number | string
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant = 'default', padding, style, ...rest },
  ref,
) {
  const merged: CSSProperties = padding != null ? { padding, ...style } : (style ?? {})
  return (
    <div
      ref={ref}
      className={cx(variant === 'quiet' ? 'ds-card-quiet' : 'ds-card', className)}
      style={merged}
      {...rest}
    />
  )
})

// ─── Button ─────────────────────────────────────────────────────────────────

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', loading, leftIcon, rightIcon, fullWidth, disabled, children, style, ...rest },
  ref,
) {
  const variantClass =
    variant === 'primary'  ? 'ds-btn-primary'   :
    variant === 'ghost'    ? 'ds-btn-ghost'     :
                             'ds-btn-secondary'
  const sizeClass = size === 'sm' ? 'ds-btn-sm' : size === 'lg' ? 'ds-btn-lg' : ''
  const mergedStyle = fullWidth ? { width: '100%', ...style } : style
  return (
    <button
      ref={ref}
      className={cx('ds-btn', variantClass, sizeClass, className)}
      disabled={disabled || loading}
      style={mergedStyle}
      {...rest}
    >
      {loading ? <Spinner /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  )
})

// ─── Icon button ────────────────────────────────────────────────────────────

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  bordered?: boolean
  size?: number
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, bordered, size, style, ...rest },
  ref,
) {
  const mergedStyle: CSSProperties | undefined =
    size != null ? { width: size, height: size, ...style } : style
  return (
    <button
      ref={ref}
      className={cx('ds-icon-btn', bordered && 'ds-icon-btn-bordered', className)}
      style={mergedStyle}
      {...rest}
    />
  )
})

// ─── Input ──────────────────────────────────────────────────────────────────

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  state?: 'default' | 'success' | 'error'
  /** Slot rendered inside the input at the left (e.g. an icon). */
  leftAdornment?: ReactNode
  /** Slot rendered inside the input at the right (e.g. show-password toggle). */
  rightAdornment?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, state = 'default', leftAdornment, rightAdornment, style, ...rest },
  ref,
) {
  const stateClass = state === 'success' ? 'ds-input-success' : state === 'error' ? 'ds-input-error' : ''
  const padding: CSSProperties = {}
  if (leftAdornment)  padding.paddingLeft  = 38
  if (rightAdornment) padding.paddingRight = 42

  if (!leftAdornment && !rightAdornment) {
    return <input ref={ref} className={cx('ds-input', stateClass, className)} style={style} {...rest} />
  }
  return (
    <div style={{ position: 'relative' }}>
      {leftAdornment && (
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: 'var(--ds-text-tertiary)', pointerEvents: 'none' }}>
          {leftAdornment}
        </span>
      )}
      <input
        ref={ref}
        className={cx('ds-input', stateClass, className)}
        style={{ ...padding, ...style }}
        {...rest}
      />
      {rightAdornment && (
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
          {rightAdornment}
        </span>
      )}
    </div>
  )
})

// ─── Label ──────────────────────────────────────────────────────────────────

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  variant?: 'default' | 'micro'
  hint?: ReactNode
}

export function Label({ className, variant = 'default', hint, children, ...rest }: LabelProps) {
  return (
    <label className={cx(variant === 'micro' ? 'ds-label-micro' : 'ds-label', className)} {...rest}>
      {children}
      {hint && (
        <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--ds-text-faint)' }}>{hint}</span>
      )}
    </label>
  )
}

// ─── Badge ──────────────────────────────────────────────────────────────────

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
}

export function Badge({ className, tone = 'neutral', style, ...rest }: BadgeProps) {
  const toneStyle: CSSProperties =
    tone === 'accent'  ? { color: 'var(--ds-accent)',  background: 'var(--ds-accent-soft)',  borderColor: 'var(--ds-accent-line)' } :
    tone === 'success' ? { color: 'var(--ds-success)', background: 'var(--ds-success-soft)', borderColor: 'rgba(90,209,153,0.22)' } :
    tone === 'warning' ? { color: 'var(--ds-warning)', background: 'var(--ds-warning-soft)', borderColor: 'rgba(245,179,82,0.22)' } :
    tone === 'danger'  ? { color: 'var(--ds-danger)',  background: 'var(--ds-danger-soft)',  borderColor: 'rgba(241,117,117,0.22)' } :
                         {}
  return <span className={cx('ds-badge', className)} style={{ ...toneStyle, ...style }} {...rest} />
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: number | string
  height?: number | string
  radius?: number | string
}

export function Skeleton({ width, height = 14, radius, style, className, ...rest }: SkeletonProps) {
  return (
    <div
      className={cx('ds-skeleton', className)}
      style={{ width: width ?? '100%', height, borderRadius: radius, ...style }}
      {...rest}
    />
  )
}

// ─── Spinner (small inline loader) ──────────────────────────────────────────

export function Spinner({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block' }}>
      <circle cx="12" cy="12" r="9" stroke={color} strokeOpacity="0.18" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ transformOrigin: 'center', animation: 'ds-spinner-spin 0.7s linear infinite' }}
      />
      <style>{'@keyframes ds-spinner-spin { to { transform: rotate(360deg); } }'}</style>
    </svg>
  )
}

// ─── Message (inline status) ────────────────────────────────────────────────

export interface MessageProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'error' | 'success' | 'info'
}

export function Message({ className, tone = 'info', ...rest }: MessageProps) {
  const toneClass =
    tone === 'error'   ? 'ds-message-error'   :
    tone === 'success' ? 'ds-message-success' :
                         'ds-message-info'
  return <div className={cx('ds-message', toneClass, className)} {...rest} />
}

// ─── FieldGroup — label + control + helper text ─────────────────────────────

export interface FieldGroupProps {
  label?: ReactNode
  hint?: ReactNode
  helper?: ReactNode
  error?: ReactNode
  htmlFor?: string
  children: ReactNode
}

export function FieldGroup({ label, hint, helper, error, htmlFor, children }: FieldGroupProps) {
  return (
    <div>
      {label && <Label htmlFor={htmlFor} hint={hint}>{label}</Label>}
      {children}
      {error ? (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ds-danger)' }}>{error}</p>
      ) : helper ? (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ds-text-tertiary)' }}>{helper}</p>
      ) : null}
    </div>
  )
}

'use client'

import { use, useEffect, useMemo, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, ChevronDown, Send } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType = 'text' | 'number' | 'textarea' | 'radio'

interface FormField {
  id: string
  type: FieldType
  label: string
  required: boolean
  placeholder?: string
  options?: string[]
}

interface EventOption {
  id: string
  name: string
  event_date: string
  service_type: string
  groups: { name: string } | null
}

interface PageData {
  form: { id: string; name: string }
  church: { name: string; slug: string }
  events: EventOption[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.032)',
  border: '1px solid rgba(255,255,255,0.080)',
  color: 'rgba(255,255,255,0.88)',
  borderRadius: 12,
  padding: '10px 14px',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
}

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)',
  backdropFilter: 'blur(32px) saturate(180%)',
  WebkitBackdropFilter: 'blur(32px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.065)',
  borderRadius: 20,
  boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 16px 48px rgba(0,0,0,0.35)',
  padding: 24,
}

function focusIn(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'rgba(201,168,76,0.50)'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.10)'
}
function focusOut(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.080)'
  e.currentTarget.style.boxShadow = 'none'
}

// ─── Inner component (uses useSearchParams so needs Suspense) ────────────────

function PublicFormInner({ formId }: { formId: string }) {
  const searchParams = useSearchParams()
  const preselectedEventId = searchParams.get('event')

  const [pageData, setPageData] = useState<PageData | null>(null)
  const [formDef, setFormDef] = useState<FormField[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>(preselectedEventId ?? '')
  const [churchId, setChurchId] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string | number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const [pageRes, formRes] = await Promise.all([
        fetch(`/api/forms/${formId}/events`),
        fetch(`/api/forms/${formId}`),
      ])
      if (!pageRes.ok || !formRes.ok) { setLoading(false); return }
      const [page, form] = await Promise.all([pageRes.json(), formRes.json()])
      setPageData(page)
      setFormDef(form.fields ?? [])
      setChurchId(form.church_id)
      const init: Record<string, string | number> = {}
      for (const f of form.fields ?? []) {
        init[f.id] = f.type === 'number' ? 0 : ''
      }
      setValues(init)
      setLoading(false)
    }
    load()
  }, [formId])

  const setValue = (fieldId: string, val: string | number) =>
    setValues(prev => ({ ...prev, [fieldId]: val }))

  const selectedEvent = useMemo(
    () => pageData?.events.find(e => e.id === selectedEventId) ?? null,
    [pageData, selectedEventId]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEventId) { setError('Please select an event.'); return }

    for (const field of formDef) {
      if (field.required) {
        const v = values[field.id]
        if (v === '' || v === null || v === undefined) {
          setError(`"${field.label}" is required.`)
          return
        }
      }
    }

    setSaving(true)
    setError(null)

    if (!churchId) { setError('Form data not loaded. Please refresh.'); setSaving(false); return }

    const submittedBy = (values['leader_name'] as string) || undefined

    const res = await fetch(`/api/events/${selectedEventId}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        form_id: formId,
        church_id: churchId,
        submitted_by: submittedBy,
        responses: values,
      }),
    })

    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to submit')
      setSaving(false)
      return
    }

    setSubmitted(true)
    setSaving(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600, margin: '0 auto', padding: '48px 16px' }}>
        {[1, 2, 3].map(i => <div key={i} className="shimmer" style={{ height: 96, borderRadius: 20, background: 'rgba(255,255,255,0.04)' }} />)}
      </div>
    )
  }

  if (!pageData) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '80px 16px', textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.44)', fontSize: 15 }}>Form not found.</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '80px 16px', textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)',
        }}>
          <CheckCircle2 style={{ width: 34, height: 34, color: '#34d399' }} />
        </div>
        <h2 className="text-display" style={{ marginBottom: 12 }}>Report Submitted</h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.44)', lineHeight: 1.6, margin: 0 }}>
          Your {pageData.form.name} for <strong style={{ color: 'rgba(255,255,255,0.70)' }}>{selectedEvent?.name}</strong> has been received.
          Thank you!
        </p>
        {selectedEvent && (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)', marginTop: 8 }}>
            {fmtDate(selectedEvent.event_date)}
          </p>
        )}
        <button
          onClick={() => {
            setSubmitted(false)
            setValues(Object.fromEntries(formDef.map(f => [f.id, f.type === 'number' ? 0 : ''])))
          }}
          style={{
            marginTop: 32, padding: '10px 24px', borderRadius: 12, fontSize: 13, fontWeight: 500,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.60)', cursor: 'pointer',
          }}
        >
          Submit Another
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 16px 64px' }}>

      {/* Church + form header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', margin: '0 0 8px' }}>
          {pageData.church.name}
        </p>
        <h1 className="text-display">{pageData.form.name}</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 12, fontSize: 13, background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.20)' }}>
            {error}
          </div>
        )}

        {/* Event selector */}
        <div style={cardStyle}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.80)', marginBottom: 10 }}>
            Which event is this report for? <span style={{ color: '#f87171' }}>*</span>
          </label>
          {preselectedEventId && selectedEvent ? (
            <div style={{
              padding: '10px 14px', borderRadius: 12, fontSize: 14,
              background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.20)',
              color: 'rgba(255,255,255,0.80)',
            }}>
              <span style={{ fontWeight: 500 }}>{selectedEvent.name}</span>
              <span style={{ color: 'rgba(255,255,255,0.40)', marginLeft: 8 }}>{fmtDate(selectedEvent.event_date)}</span>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <select
                value={selectedEventId}
                onChange={e => setSelectedEventId(e.target.value)}
                required
                style={{ ...inputStyle, paddingRight: 36, colorScheme: 'dark', appearance: 'none' }}
                onFocus={focusIn}
                onBlur={focusOut}
              >
                <option value="">Select an event…</option>
                {pageData.events.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} — {fmtDate(ev.event_date)}
                  </option>
                ))}
              </select>
              <ChevronDown style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
            </div>
          )}
        </div>

        {/* Form fields */}
        {formDef.map(field => (
          <div key={field.id} style={cardStyle}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.80)', marginBottom: 10 }}>
              {field.label}
              {field.required && <span style={{ color: '#f87171', marginLeft: 4 }}>*</span>}
            </label>

            {field.type === 'text' && (
              <input
                type="text"
                value={values[field.id] as string ?? ''}
                onChange={e => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                required={field.required}
                style={inputStyle}
                onFocus={focusIn}
                onBlur={focusOut}
              />
            )}

            {field.type === 'number' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setValue(field.id, Math.max(0, (values[field.id] as number ?? 0) - 1))}
                  style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', fontSize: 22, fontWeight: 300, lineHeight: 1 }}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  value={values[field.id] as number ?? 0}
                  onChange={e => setValue(field.id, Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ ...inputStyle, textAlign: 'center', width: 80, flex: 'none' }}
                  onFocus={focusIn}
                  onBlur={focusOut}
                />
                <button
                  type="button"
                  onClick={() => setValue(field.id, (values[field.id] as number ?? 0) + 1)}
                  style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', fontSize: 22, fontWeight: 300, lineHeight: 1 }}
                >
                  +
                </button>
              </div>
            )}

            {field.type === 'textarea' && (
              <textarea
                value={values[field.id] as string ?? ''}
                onChange={e => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                rows={4}
                required={field.required}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }}
                onFocus={focusIn}
                onBlur={focusOut}
              />
            )}

            {field.type === 'radio' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(field.options ?? []).map(opt => {
                  const active = values[field.id] === opt
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setValue(field.id, opt)}
                      style={{
                        padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                        border: `1px solid ${active ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.10)'}`,
                        background: active ? 'rgba(201,168,76,0.14)' : 'rgba(255,255,255,0.04)',
                        color: active ? '#C9A84C' : 'rgba(255,255,255,0.55)',
                        cursor: 'pointer', transition: 'all 0.12s ease',
                      }}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}

        <button
          type="submit"
          disabled={saving || !selectedEventId}
          className="btn-primary"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 0', borderRadius: 14, fontSize: 15, fontWeight: 600,
            marginTop: 8,
          }}
        >
          <Send style={{ width: 15, height: 15 }} />
          {saving ? 'Submitting…' : 'Submit Report'}
        </button>
      </form>
    </div>
  )
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function PublicFormPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = use(params)
  return (
    <div style={{ minHeight: '100vh', background: '#050810', backgroundImage: 'radial-gradient(ellipse 65% 55% at 0% 0%, rgba(79,127,196,0.13) 0%, transparent 65%), radial-gradient(ellipse 55% 45% at 100% 100%, rgba(79,127,196,0.09) 0%, transparent 65%)', color: 'rgba(255,255,255,0.90)', fontFamily: 'system-ui, sans-serif', WebkitFontSmoothing: 'antialiased' }}>
      <Suspense fallback={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600, margin: '0 auto', padding: '48px 16px' }}>
          {[1, 2, 3].map(i => <div key={i} className="shimmer" style={{ height: 96, borderRadius: 20, background: 'rgba(255,255,255,0.04)' }} />)}
        </div>
      }>
        <PublicFormInner formId={formId} />
      </Suspense>
    </div>
  )
}

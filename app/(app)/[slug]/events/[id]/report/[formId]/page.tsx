'use client'

import { use, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowLeft, Send } from 'lucide-react'

type FieldType = 'text' | 'number' | 'textarea' | 'radio'

interface FormField {
  id: string
  type: FieldType
  label: string
  required: boolean
  placeholder?: string
  options?: string[]
}

interface FormDef {
  id: string
  name: string
  description: string | null
  fields: FormField[]
}

interface EventInfo {
  id: string
  name: string
  event_date: string
}

export default function FillFormPage({
  params,
}: {
  params: Promise<{ id: string; formId: string }>
}) {
  const { id: eventId, formId } = use(params)
  const routeParams = useParams()
  const router = useRouter()
  const slug = routeParams?.slug as string

  const [form, setForm] = useState<FormDef | null>(null)
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [churchId, setChurchId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [values, setValues] = useState<Record<string, string | number>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const sb = getSupabaseBrowser()
      const [{ data: church }, formRes, { data: ev }] = await Promise.all([
        sb.from('churches').select('id').eq('slug', slug).single(),
        fetch(`/api/forms/${formId}`),
        sb.from('events').select('id, name, event_date').eq('id', eventId).single(),
      ])

      if (church) setChurchId(church.id)
      if (formRes.ok) {
        const f = await formRes.json()
        setForm(f)
        // Initialize values
        const init: Record<string, string | number> = {}
        for (const field of f.fields ?? []) {
          init[field.id] = field.type === 'number' ? 0 : ''
        }
        setValues(init)
      }
      setEvent(ev as EventInfo)
      setLoading(false)
    }
    load()
  }, [slug, eventId, formId])

  const setValue = (fieldId: string, val: string | number) => {
    setValues(prev => ({ ...prev, [fieldId]: val }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!churchId || !form) return

    // Validate required fields
    for (const field of form.fields) {
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

    const submittedBy = (values['leader_name'] as string) || undefined

    const res = await fetch(`/api/events/${eventId}/responses`, {
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

    router.push(`/${slug}/events/${eventId}`)
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

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.032)', border: '1px solid rgba(255,255,255,0.080)',
    color: 'rgba(255,255,255,0.88)', borderRadius: 12, padding: '10px 14px', fontSize: 14, outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  }

  const focusIn = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = 'rgba(201,168,76,0.50)'
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.10)'
  }
  const focusOut = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.080)'
    e.currentTarget.style.boxShadow = 'none'
  }

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3].map(i => <div key={i} className="shimmer" style={{ height: 96, borderRadius: 20, background: 'rgba(255,255,255,0.04)' }} />)}
      </div>
    )
  }

  if (!form) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'rgba(255,255,255,0.44)' }}>Form not found.</p>
      </div>
    )
  }

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 16px 48px' }}>

        <Link
          href={`/${slug}/events/${eventId}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.44)', textDecoration: 'none', marginBottom: 24, transition: 'color 0.12s ease' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.72)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.44)')}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          Back to Event
        </Link>

        {/* Form header */}
        <div style={{ marginBottom: 24 }}>
          <h1 className="text-display" style={{ marginBottom: 6 }}>{form.name}</h1>
          {event && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.44)', margin: 0 }}>
              {event.name} · {fmtDate(event.event_date)}
            </p>
          )}
          {form.description && (
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.44)', marginTop: 8, margin: '8px 0 0' }}>
              {form.description}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 12, fontSize: 13, background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.20)' }}>
              {error}
            </div>
          )}

          {form.fields.map(field => (
            <div key={field.id} style={cardStyle}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.80)', marginBottom: 10 }}>
                {field.label}
                {field.required && <span style={{ color: '#f87171', marginLeft: 4 }}>*</span>}
              </label>

              {/* Text */}
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

              {/* Number */}
              {field.type === 'number' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setValue(field.id, Math.max(0, (values[field.id] as number ?? 0) - 1))}
                    style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', fontSize: 20, fontWeight: 300, transition: 'background 0.12s ease' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
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
                    style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', fontSize: 20, fontWeight: 300, transition: 'background 0.12s ease' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  >
                    +
                  </button>
                  {field.placeholder && (
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', marginLeft: 4 }}>{field.placeholder}</span>
                  )}
                </div>
              )}

              {/* Textarea */}
              {field.type === 'textarea' && (
                <textarea
                  value={values[field.id] as string ?? ''}
                  onChange={e => setValue(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  rows={4}
                  required={field.required}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 96 }}
                  onFocus={focusIn}
                  onBlur={focusOut}
                />
              )}

              {/* Radio */}
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
                          padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500,
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

          {/* Submit */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0', borderRadius: 14, fontSize: 14, fontWeight: 600 }}
            >
              <Send style={{ width: 14, height: 14 }} />
              {saving ? 'Submitting…' : 'Submit Report'}
            </button>
            <Link
              href={`/${slug}/events/${eventId}`}
              style={{
                flex: 1, padding: '13px 0', borderRadius: 14, fontSize: 14, fontWeight: 500,
                textAlign: 'center', textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)',
                background: 'rgba(255,255,255,0.04)', transition: 'background 0.12s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

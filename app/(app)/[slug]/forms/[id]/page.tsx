'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown,
  GripVertical, Type, Hash, AlignLeft, ToggleLeft, Check, Save,
  ImageIcon, Link2, Copy, CheckCheck, ChevronRight,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType = 'text' | 'number' | 'textarea' | 'radio' | 'photo'

interface FormField {
  id: string
  type: FieldType
  label: string
  required: boolean
  placeholder?: string
  options?: string[]
}

interface FormData {
  id: string
  name: string
  description: string | null
  is_preset: boolean
  fields: FormField[]
}

interface FormResponse {
  id: string
  submitted_by: string | null
  created_at: string
  responses: Record<string, unknown>
  events: { name: string; event_date: string } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FIELD_TYPES: { type: FieldType; label: string; icon: React.ElementType }[] = [
  { type: 'text',     label: 'Text',      icon: Type },
  { type: 'number',   label: 'Number',    icon: Hash },
  { type: 'textarea', label: 'Long Text', icon: AlignLeft },
  { type: 'radio',    label: 'Choice',    icon: ToggleLeft },
  { type: 'photo',    label: 'Photo',     icon: ImageIcon },
]

function newField(type: FieldType): FormField {
  return {
    id: crypto.randomUUID(),
    type,
    label: '',
    required: false,
    placeholder: '',
    options: type === 'radio' ? ['Option 1', 'Option 2'] : undefined,
  }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.032)', border: '1px solid rgba(255,255,255,0.080)',
  color: 'rgba(255,255,255,0.88)', borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
}

const focus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = 'rgba(201,168,76,0.50)'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.10)'
}
const blur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.080)'
  e.currentTarget.style.boxShadow = 'none'
}

// ─── Field type icon ──────────────────────────────────────────────────────────

function TypeIcon({ type }: { type: FieldType }) {
  const icons: Record<FieldType, React.ElementType> = {
    text: Type, number: Hash, textarea: AlignLeft, radio: ToggleLeft, photo: ImageIcon,
  }
  const Icon = icons[type]
  return <Icon style={{ width: 13, height: 13, color: '#C9A84C', flexShrink: 0 }} />
}

// ─── Field editor ─────────────────────────────────────────────────────────────

function FieldEditor({
  field, index, total, onChange, onDelete, onMove,
}: {
  field: FormField
  index: number
  total: number
  onChange: (patch: Partial<FormField>) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const [expanded, setExpanded] = useState(!field.label)

  const addOption    = () => onChange({ options: [...(field.options ?? []), `Option ${(field.options?.length ?? 0) + 1}`] })
  const removeOption = (i: number) => onChange({ options: field.options?.filter((_, j) => j !== i) })
  const setOption    = (i: number, val: string) => { const n = [...(field.options ?? [])]; n[i] = val; onChange({ options: n }) }

  return (
    <div style={{ background: 'rgba(255,255,255,0.028)', border: '1px solid rgba(255,255,255,0.065)', borderRadius: 14, overflow: 'hidden' }}>
      {/* Collapsed row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
        <GripVertical style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.20)', flexShrink: 0 }} />
        <TypeIcon type={field.type} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: field.label ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.28)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {field.label || 'Untitled field'}
        </span>
        {field.required && (
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 99, background: 'rgba(251,191,36,0.10)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.20)', flexShrink: 0 }}>
            Required
          </span>
        )}
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', flexShrink: 0 }}>
          {FIELD_TYPES.find(t => t.type === field.type)?.label}
        </span>
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button disabled={index === 0} onClick={() => onMove(-1)} style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', color: 'rgba(255,255,255,0.30)', opacity: index === 0 ? 0.3 : 1 }} onMouseEnter={e => { if (index > 0) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <ChevronUp style={{ width: 13, height: 13 }} />
          </button>
          <button disabled={index === total - 1} onClick={() => onMove(1)} style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: index === total - 1 ? 'not-allowed' : 'pointer', color: 'rgba(255,255,255,0.30)', opacity: index === total - 1 ? 0.3 : 1 }} onMouseEnter={e => { if (index < total - 1) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <ChevronDown style={{ width: 13, height: 13 }} />
          </button>
          <button onClick={onDelete} style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.28)' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.10)'; e.currentTarget.style.color = '#f87171' }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(255,255,255,0.28)' }}>
            <Trash2 style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '14px', borderTop: '1px solid rgba(255,255,255,0.042)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Label + Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 5 }}>Label</label>
              <input type="text" value={field.label} onChange={e => onChange({ label: e.target.value })} placeholder="Field label" style={inputStyle} onFocus={focus} onBlur={blur} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 5 }}>Type</label>
              <select value={field.type} onChange={e => onChange({ type: e.target.value as FieldType, options: e.target.value === 'radio' ? ['Option 1', 'Option 2'] : undefined })} style={{ ...inputStyle, width: 'auto', colorScheme: 'dark' }}>
                {FIELD_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Placeholder */}
          {(field.type === 'text' || field.type === 'number' || field.type === 'textarea') && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 5 }}>Placeholder</label>
              <input type="text" value={field.placeholder ?? ''} onChange={e => onChange({ placeholder: e.target.value })} placeholder="Hint text shown inside the field…" style={inputStyle} onFocus={focus} onBlur={blur} />
            </div>
          )}

          {/* Photo info */}
          {field.type === 'photo' && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
              Respondents will be prompted to upload a photo (JPEG, PNG, WEBP — max 10 MB).
            </p>
          )}

          {/* Radio options */}
          {field.type === 'radio' && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 8 }}>Choices</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(field.options ?? []).map((opt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6 }}>
                    <input type="text" value={opt} onChange={e => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} style={{ ...inputStyle, flex: 1 }} onFocus={focus} onBlur={blur} />
                    <button onClick={() => removeOption(i)} disabled={(field.options?.length ?? 0) <= 1} style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', opacity: (field.options?.length ?? 0) <= 1 ? 0.3 : 1 }} onMouseEnter={e => { if ((field.options?.length ?? 0) > 1) { e.currentTarget.style.background = 'rgba(248,113,113,0.10)'; e.currentTarget.style.color = '#f87171' } }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}>
                      <Trash2 style={{ width: 11, height: 11 }} />
                    </button>
                  </div>
                ))}
                <button onClick={addOption} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', alignSelf: 'flex-start' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')} onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}>
                  <Plus style={{ width: 11, height: 11 }} /> Add choice
                </button>
              </div>
            </div>
          )}

          {/* Required toggle */}
          <button type="button" onClick={() => onChange({ required: !field.required })} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>
            <div style={{ width: 32, height: 19, borderRadius: 99, position: 'relative', flexShrink: 0, backgroundColor: field.required ? '#A88A35' : 'rgba(255,255,255,0.12)', transition: 'background-color 0.15s ease' }}>
              <span style={{ position: 'absolute', top: 3, width: 13, height: 13, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.30)', transition: 'left 0.15s ease', left: field.required ? '16px' : '3px' }} />
            </div>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.60)' }}>Required</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Responses view ───────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function ResponsesView({ formId, fields }: { formId: string; fields: FormField[] }) {
  const [responses, setResponses]   = useState<FormResponse[]>([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/forms/${formId}/responses`)
      .then(r => r.json())
      .then(d => { setResponses(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [formId])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        {[1, 2, 3].map(i => <div key={i} className="shimmer" style={{ height: 60, borderRadius: 14, background: 'rgba(255,255,255,0.04)' }} />)}
      </div>
    )
  }

  if (responses.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '56px 0', color: 'rgba(255,255,255,0.28)', fontSize: 14 }}>
        No responses yet. Share the form link to start collecting.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '0 0 4px' }}>
        {responses.length} response{responses.length !== 1 ? 's' : ''}
      </p>
      {responses.map(r => {
        const isOpen = expanded === r.id
        const ev = r.events as { name: string; event_date: string } | null
        return (
          <div key={r.id} style={{ background: 'rgba(255,255,255,0.028)', border: '1px solid rgba(255,255,255,0.065)', borderRadius: 14, overflow: 'hidden' }}>
            {/* Row */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
              onClick={() => setExpanded(isOpen ? null : r.id)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.80)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev?.name ?? 'Unknown event'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                  {ev ? fmtDate(ev.event_date) : ''}{r.submitted_by ? ` · ${r.submitted_by}` : ''}
                </p>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', flexShrink: 0 }}>
                {fmtDateTime(r.created_at)}
              </span>
              <ChevronRight style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.25)', flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.042)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {fields.map(field => {
                  const val = r.responses[field.id]
                  if (val === undefined || val === null || val === '') return null
                  return (
                    <div key={field.id}>
                      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)' }}>
                        {field.label}
                      </p>
                      {field.type === 'photo' ? (
                        <a href={String(val)} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={String(val)}
                            alt={field.label}
                            style={{ maxWidth: 240, maxHeight: 180, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                          />
                        </a>
                      ) : (
                        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.72)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {String(val)}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: formId } = use(params)
  const routeParams = useParams()
  const router = useRouter()
  const slug = routeParams?.slug as string

  const [form, setForm]           = useState<FormData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [name, setName]           = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields]       = useState<FormField[]>([])
  const [tab, setTab]             = useState<'build' | 'responses'>('build')
  const [copied, setCopied]       = useState(false)

  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/form/${formId}`
    : `/form/${formId}`

  useEffect(() => {
    fetch(`/api/forms/${formId}`)
      .then(r => r.json())
      .then(data => {
        setForm(data)
        setName(data.name)
        setDescription(data.description ?? '')
        setFields(data.fields ?? [])
        setLoading(false)
      })
  }, [formId])

  const save = useCallback(async (nameVal: string, descVal: string, fieldsVal: FormField[]) => {
    setSaving(true)
    await fetch(`/api/forms/${formId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameVal, description: descVal, fields: fieldsVal }),
    })
    setSaving(false)
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 2000)
  }, [formId])

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const addField    = (type: FieldType) => setFields(prev => [...prev, newField(type)])
  const updateField = (i: number, patch: Partial<FormField>) => setFields(prev => prev.map((f, j) => j === i ? { ...f, ...patch } : f))
  const deleteField = (i: number) => setFields(prev => prev.filter((_, j) => j !== i))
  const moveField   = (i: number, dir: -1 | 1) => setFields(prev => {
    const next = [...prev]; const t = i + dir
    if (t < 0 || t >= next.length) return prev;
    [next[i], next[t]] = [next[t], next[i]]; return next
  })

  const pageInputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.032)', border: '1px solid rgba(255,255,255,0.080)',
    color: 'rgba(255,255,255,0.88)', borderRadius: 12, padding: '10px 14px', fontSize: 14, outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  }

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[1, 2, 3].map(i => <div key={i} className="shimmer" style={{ height: 80, borderRadius: 16, background: 'rgba(255,255,255,0.04)' }} />)}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 64px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Link
            href={`/${slug}/forms`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.44)', textDecoration: 'none', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.72)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.44)')}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} /> Back
          </Link>

          {/* Tabs */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 3, gap: 2 }}>
              {(['build', 'responses'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '6px 16px', borderRadius: 7, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
                    background: tab === t ? 'rgba(255,255,255,0.09)' : 'none',
                    color: tab === t ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.40)',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {t === 'build' ? 'Build' : 'Responses'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => save(name, description, fields)}
            disabled={saving || tab === 'responses'}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, flexShrink: 0, opacity: tab === 'responses' ? 0 : 1 }}
          >
            {saved ? <><CheckCheck style={{ width: 13, height: 13 }} /> Saved</> : <><Save style={{ width: 13, height: 13 }} /> {saving ? 'Saving…' : 'Save'}</>}
          </button>
        </div>

        {/* ── Share panel ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, marginBottom: 20,
          background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <Link2 style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.40)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {publicUrl}
          </span>
          <button
            onClick={copyLink}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, flexShrink: 0, border: 'none', cursor: 'pointer',
              background: copied ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.06)',
              color: copied ? '#34d399' : 'rgba(255,255,255,0.60)',
              transition: 'all 0.15s ease',
            }}
          >
            {copied ? <CheckCheck style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, flexShrink: 0, textDecoration: 'none',
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.60)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = 'rgba(255,255,255,0.88)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.60)' }}
          >
            Preview
          </a>
        </div>

        {/* ── Build tab ── */}
        {tab === 'build' && (
          <>
            {/* Form meta */}
            <div style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)', border: '1px solid rgba(255,255,255,0.065)', borderRadius: 20, padding: 24, marginBottom: 16, boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 16px 48px rgba(0,0,0,0.35)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 6 }}>Form Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Form name" style={pageInputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.50)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.10)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.080)'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 6 }}>
                    Description <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                  </label>
                  <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description…" style={pageInputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.50)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.10)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.080)'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>
              </div>
            </div>

            {/* Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {fields.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.10)', borderRadius: 16, color: 'rgba(255,255,255,0.28)', fontSize: 13 }}>
                  No fields yet — add one below.
                </div>
              )}
              {fields.map((field, i) => (
                <FieldEditor key={field.id} field={field} index={i} total={fields.length}
                  onChange={patch => updateField(i, patch)}
                  onDelete={() => deleteField(i)}
                  onMove={dir => moveField(i, dir)}
                />
              ))}
            </div>

            {/* Add field */}
            <div style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.052)', borderRadius: 16, padding: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', margin: '0 0 12px' }}>Add Field</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {FIELD_TYPES.map(({ type, label, icon: Icon }) => (
                  <button key={type} onClick={() => addField(type)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.60)', cursor: 'pointer', transition: 'all 0.12s ease' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.10)'; e.currentTarget.style.color = '#C9A84C'; e.currentTarget.style.borderColor = 'rgba(201,168,76,0.22)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.60)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)' }}
                  >
                    <Icon style={{ width: 13, height: 13 }} /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Save footer */}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => save(name, description, fields)} disabled={saving} className="btn-primary" style={{ flex: 1, padding: '12px 0', borderRadius: 14, fontSize: 14, fontWeight: 600 }}>
                {saving ? 'Saving…' : 'Save Form'}
              </button>
              <Link href={`/${slug}/forms`} style={{ flex: 1, padding: '12px 0', borderRadius: 14, fontSize: 14, fontWeight: 500, textAlign: 'center', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.04)', transition: 'background 0.12s ease' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              >
                Cancel
              </Link>
            </div>
          </>
        )}

        {/* ── Responses tab ── */}
        {tab === 'responses' && (
          <ResponsesView formId={formId} fields={fields} />
        )}
      </div>
    </div>
  )
}

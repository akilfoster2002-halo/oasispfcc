'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { Plus, FileText, Lock, Pencil, Trash2, ChevronRight } from 'lucide-react'

interface Form {
  id: string
  name: string
  description: string | null
  is_preset: boolean
  fields: FormField[]
  created_at: string
}

interface FormField {
  id: string
  type: string
  label: string
  required: boolean
}

export default function FormsPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string

  const [forms, setForms] = useState<Form[]>([])
  const [churchId, setChurchId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const load = async () => {
      const sb = getSupabaseBrowser()
      const { data: church } = await sb.from('churches').select('id').eq('slug', slug).single()
      if (!church) { setLoading(false); return }
      setChurchId(church.id)

      const res = await fetch(`/api/forms?church_id=${church.id}`)
      if (res.ok) setForms(await res.json())
      setLoading(false)
    }
    load()
  }, [slug])

  const handleCreate = async () => {
    if (!churchId || creating) return
    setCreating(true)
    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ church_id: churchId, name: 'Untitled Form', fields: [] }),
    })
    if (res.ok) {
      const { id } = await res.json()
      router.push(`/${slug}/forms/${id}`)
    }
    setCreating(false)
  }

  const handleDelete = async (form: Form) => {
    if (!confirm(`Delete "${form.name}"? This cannot be undone.`)) return
    setDeleting(form.id)
    await fetch(`/api/forms/${form.id}`, { method: 'DELETE' })
    setForms(prev => prev.filter(f => f.id !== form.id))
    setDeleting(null)
  }

  const cardStyle: React.CSSProperties = {
    background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)',
    backdropFilter: 'blur(32px) saturate(180%)',
    WebkitBackdropFilter: 'blur(32px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.065)',
    borderRadius: 20,
    boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 16px 48px rgba(0,0,0,0.35)',
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 className="text-display" style={{ marginBottom: 6 }}>Forms</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.44)', margin: 0 }}>
            Create and manage report forms for your events.
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600, flexShrink: 0 }}
        >
          <Plus style={{ width: 14, height: 14 }} />
          {creating ? 'Creating…' : 'New Form'}
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="shimmer" style={{ height: 80, borderRadius: 16, background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : forms.length === 0 ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: 'center' }}>
          <FileText style={{ width: 36, height: 36, color: 'rgba(255,255,255,0.15)', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.55)', margin: '0 0 6px' }}>No forms yet</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)', margin: 0 }}>Create a form to collect reports from your cell leaders.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {forms.map(form => (
            <div
              key={form.id}
              style={{
                ...cardStyle,
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 20px',
                transition: 'border-color 0.15s ease',
              }}
            >
              {/* Icon */}
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: form.is_preset ? 'rgba(129,140,248,0.12)' : 'rgba(52,211,153,0.10)',
                border: form.is_preset ? '1px solid rgba(129,140,248,0.20)' : '1px solid rgba(52,211,153,0.18)',
              }}>
                {form.is_preset
                  ? <Lock style={{ width: 16, height: 16, color: '#818cf8' }} />
                  : <FileText style={{ width: 16, height: 16, color: '#34d399' }} />
                }
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.88)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {form.name}
                  </p>
                  {form.is_preset && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: 'rgba(129,140,248,0.12)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.20)', flexShrink: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Preset
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '3px 0 0' }}>
                  {form.fields.length} field{form.fields.length !== 1 ? 's' : ''}
                  {form.description ? ` · ${form.description}` : ''}
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <Link
                  href={`/${slug}/forms/${form.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8,
                    fontSize: 12, fontWeight: 500, textDecoration: 'none',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                    color: 'rgba(255,255,255,0.60)', transition: 'background 0.12s ease, color 0.12s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = 'rgba(255,255,255,0.88)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.60)' }}
                >
                  <Pencil style={{ width: 11, height: 11 }} />
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(form)}
                  disabled={deleting === form.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 30, height: 30, borderRadius: 8,
                    background: 'none', border: '1px solid rgba(255,255,255,0.07)',
                    color: 'rgba(255,255,255,0.28)', cursor: 'pointer',
                    transition: 'background 0.12s ease, color 0.12s ease, border-color 0.12s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.10)'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.25)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(255,255,255,0.28)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
                >
                  <Trash2 style={{ width: 12, height: 12 }} />
                </button>
                <ChevronRight style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.18)' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

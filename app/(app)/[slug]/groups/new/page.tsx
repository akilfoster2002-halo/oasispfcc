'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { ArrowLeft } from 'lucide-react'

export default function NewGroupPage() {
  const params = useParams()
  const slug = params?.slug as string
  const router = useRouter()

  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)

    const sb = getSupabaseBrowser()

    const { data: church } = await sb.from('churches').select('id').eq('slug', slug).single()
    if (!church) {
      setError('Church not found')
      setSaving(false)
      return
    }

    const { error: err } = await sb
      .from('groups')
      .insert({ name: name.trim(), church_id: church.id })

    if (err) {
      setError(err.message)
      setSaving(false)
    } else {
      router.push(`/${slug}/groups`)
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 16px' }}>
        <Link
          href={`/${slug}/groups`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.44)', textDecoration: 'none', marginBottom: 24, transition: 'color 0.12s ease' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.72)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.44)')}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          Back to Groups
        </Link>

        <div style={{ marginBottom: 28 }}>
          <h1 className="text-display" style={{ marginBottom: 8 }}>New Group</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.44)', margin: 0 }}>Create a group to organize your cells and events.</p>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.065)',
          borderRadius: 20,
          boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 -1px 0 rgba(0,0,0,0.20) inset, 0 16px 48px rgba(0,0,0,0.35)',
          padding: 24,
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>
          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 12, fontSize: 13, background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.20)' }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'rgba(255,255,255,0.56)' }}>
              Group Name <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Youth Group"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.032)', border: '1px solid rgba(255,255,255,0.080)',
                color: 'rgba(255,255,255,0.88)', borderRadius: 12, padding: '10px 14px', fontSize: 14, outline: 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.50)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.10)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.080)'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="btn-primary"
              style={{ flex: 1, padding: '12px 0', borderRadius: 14, fontSize: 14, fontWeight: 600 }}
            >
              {saving ? 'Creating…' : 'Create Group'}
            </button>
            <Link
              href={`/${slug}/groups`}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 14, fontSize: 14, fontWeight: 500,
                textAlign: 'center', textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)',
                background: 'rgba(255,255,255,0.04)', transition: 'background 0.12s ease, color 0.12s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.80)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'

interface Region {
  id: string
  name: string
}

export default function NewGroupPage() {
  const router = useRouter()
  const [regions, setRegions] = useState<Region[]>([])
  const [form, setForm] = useState({ name: '', region_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSupabase()
      .from('regions')
      .select('id, name')
      .order('name')
      .then(({ data }) => setRegions((data as Region[]) ?? []))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError(null)
    const { data, error: err } = await getSupabase()
      .from('groups')
      .insert({ name: form.name.trim(), region_id: form.region_id || null })
      .select('id')
      .single()
    if (err) {
      setError(err.message)
      setSaving(false)
    } else {
      router.push(`/groups/${data.id}`)
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-xl">
      <Link href="/groups" className="inline-flex items-center gap-2 text-sm mb-6 hover:opacity-70"
        style={{ color: '#6B7280' }}>
        <ArrowLeft className="w-4 h-4" /> Back to Groups
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: '#111827' }}>New Group</h1>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Create a new group to organize your cells.</p>
      </div>

      <form onSubmit={handleSubmit}
        className="bg-white rounded-xl p-6 space-y-5"
        style={{ border: '1px solid #E5E7EB' }}>

        {error && (
          <div className="px-4 py-3 rounded-lg text-sm"
            style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
            Group Name <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <input
            type="text"
            required
            placeholder="Youth Group"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 text-sm rounded-lg outline-none focus:ring-2"
            style={{ border: '1px solid #E5E7EB', color: '#111827' }}
          />
        </div>

        {regions.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>Region</label>
            <select
              value={form.region_id}
              onChange={e => setForm(f => ({ ...f, region_id: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none focus:ring-2 bg-white"
              style={{ border: '1px solid #E5E7EB', color: form.region_id ? '#111827' : '#9CA3AF' }}
            >
              <option value="">Select a region…</option>
              {regions.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: '#4068E2' }}
          >
            {saving ? 'Saving…' : 'Create Group'}
          </button>
          <Link
            href="/groups"
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-center hover:bg-[#F9FAFB]"
            style={{ border: '1px solid #E5E7EB', color: '#374151' }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'

interface Cell {
  id: string
  name: string
  groups: { name: string } | null
}

export default function NewPersonPage() {
  const router = useRouter()
  const [cells, setCells] = useState<Cell[]>([])
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', cell_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await getSupabase()
        .from('cells')
        .select('id, name, groups(name)')
        .order('name')
      setCells((data as unknown as Cell[]) ?? [])
    }
    load()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name.trim()) return
    setSaving(true)
    setError(null)

    const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`.trim()

    const { data, error: err } = await getSupabase()
      .from('people')
      .insert({
        first_name: form.first_name.trim(),
        last_name:  form.last_name.trim(),
        name: fullName,
        email: form.email.trim().toLowerCase(),
        cell_id: form.cell_id || null,
      })
      .select('id')
      .single()

    if (err) {
      setError(err.message)
      setSaving(false)
    } else {
      router.push(`/people/${data.id}`)
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-xl">
      <Link href="/people" className="inline-flex items-center gap-2 text-sm mb-6 hover:opacity-70"
        style={{ color: '#6B7280' }}>
        <ArrowLeft className="w-4 h-4" /> Back to People
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: '#111827' }}>Add Person</h1>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Enter the member's details below.</p>
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
              First Name <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Jane"
              value={form.first_name}
              onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none focus:ring-2"
              style={{ border: '1px solid #E5E7EB', color: '#111827' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
              Last Name
            </label>
            <input
              type="text"
              placeholder="Smith"
              value={form.last_name}
              onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none focus:ring-2"
              style={{ border: '1px solid #E5E7EB', color: '#111827' }}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
            Email Address <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <input
            type="email"
            required
            placeholder="jane@example.com"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full px-3 py-2 text-sm rounded-lg outline-none focus:ring-2"
            style={{ border: '1px solid #E5E7EB', color: '#111827' }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>Cell Group</label>
          <select
            value={form.cell_id}
            onChange={e => setForm(f => ({ ...f, cell_id: e.target.value }))}
            className="w-full px-3 py-2 text-sm rounded-lg outline-none focus:ring-2 bg-white"
            style={{ border: '1px solid #E5E7EB', color: form.cell_id ? '#111827' : '#9CA3AF' }}
          >
            <option value="">Select a cell group…</option>
            {cells.map(cell => (
              <option key={cell.id} value={cell.id}>
                {cell.name}{cell.groups ? ` (${cell.groups.name})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: '#4068E2' }}
          >
            {saving ? 'Saving…' : 'Add Person'}
          </button>
          <Link
            href="/people"
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-center transition-colors hover:bg-[#F9FAFB]"
            style={{ border: '1px solid #E5E7EB', color: '#374151' }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

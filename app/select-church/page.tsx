'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Church, LogOut } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

interface Membership {
  id: string
  status: string
  role: string
  church: { id: string; name: string; slug: string }
}

export default function SelectChurchPage() {
  const router = useRouter()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/memberships')
      .then(r => r.json())
      .then(({ memberships: m }) => {
        const approved = (m ?? []).filter((mb: Membership) => mb.status === 'approved')
        setMemberships(approved)
        // Auto-redirect if only one church
        if (approved.length === 1) {
          router.replace(`/${approved[0].church.slug}/dashboard`)
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  async function handleSignOut() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Choose a Church</h1>
          <p className="mt-1 text-sm text-gray-500">Select which church workspace to enter</p>
        </div>

        {memberships.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            You don&apos;t have access to any churches yet.
          </div>
        ) : (
          <div className="space-y-2">
            {memberships.map(m => (
              <button
                key={m.id}
                onClick={() => router.push(`/${m.church.slug}/dashboard`)}
                className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all text-left"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}
                >
                  <Church className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{m.church.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{m.role}</p>
                </div>
                <span className="text-xs text-gray-400">Enter →</span>
              </button>
            ))}
          </div>
        )}

        <div className="text-center">
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

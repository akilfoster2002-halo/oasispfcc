'use client'

import { useEffect, useState } from 'react'
import { Clock, LogOut } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

interface Membership {
  id: string
  status: string
  church: { name: string; slug: string }
}

export default function PendingApprovalPage() {
  const router = useRouter()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/memberships')
      .then(r => r.json())
      .then(({ memberships: m }) => {
        setMemberships(m ?? [])
        // If any membership is now approved, redirect to that church
        const approved = (m ?? []).find((mb: Membership) => mb.status === 'approved')
        if (approved) router.replace(`/${approved.church.slug}/dashboard`)
      })
      .finally(() => setLoading(false))
  }, [router])

  async function handleSignOut() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/')
  }

  const pending = memberships.filter(m => m.status === 'pending')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center">
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Awaiting Approval</h1>
            <p className="mt-2 text-sm text-gray-500">
              Your request to join has been received. A church admin will review it shortly.
            </p>
          </div>
        </div>

        {!loading && pending.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {pending.map(m => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-gray-800">{m.church.name}</span>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                  Pending
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400">
          This page will automatically redirect you once approved. You can safely close and return later.
        </p>

        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}

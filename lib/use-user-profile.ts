'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from './supabase-browser'
import type { UserProfile } from './user-profile'

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseBrowser()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return }
      const { data: p } = await supabase
        .from('user_profiles')
        .select('id, role, group_id')
        .eq('id', data.user.id)
        .single()
      setProfile(p ?? null)
      setLoading(false)
    })
  }, [])

  return { profile, loading, isMaster: profile?.role === 'master' }
}

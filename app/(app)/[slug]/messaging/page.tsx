'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import MessagingPage from '@/components/pages/MessagingPage'

export default function Page() {
  const params = useParams()
  const slug = params?.slug as string
  const [churchId, setChurchId] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    getSupabaseBrowser()
      .from('churches')
      .select('id')
      .eq('slug', slug)
      .single()
      .then(({ data }) => { if (data) setChurchId(data.id) })
  }, [slug])

  if (!churchId) return null
  return <MessagingPage churchId={churchId} />
}

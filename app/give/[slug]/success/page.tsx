'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Heart } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export default function GiveSuccessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [churchName, setChurchName] = useState('')

  useEffect(() => {
    anonClient()
      .from('churches')
      .select('name')
      .eq('slug', slug)
      .single()
      .then(({ data }) => { if (data) setChurchName(data.name) })
  }, [slug])

  return (
    <div style={{ minHeight: '100vh', background: '#050810', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: 'var(--font-geist-sans, system-ui)' }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(52,211,153,0.22), rgba(16,185,129,0.10))', border: '1px solid rgba(52,211,153,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <CheckCircle style={{ width: 36, height: 36, color: '#34d399' }} />
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.94)', margin: '0 0 10px', letterSpacing: '-0.025em' }}>Thank you!</h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.50)', margin: '0 0 8px', lineHeight: 1.6 }}>
          Your gift to {churchName || 'the church'} has been received.
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)', margin: '0 0 36px', lineHeight: 1.6 }}>
          A receipt will be emailed to you if you provided your address.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 28, color: 'rgba(255,255,255,0.22)', fontSize: 13 }}>
          <Heart style={{ width: 13, height: 13 }} />
          <span>Your generosity makes an eternal impact.</span>
        </div>

        <Link href={`/give/${slug}`}
          style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 12, fontSize: 14, fontWeight: 600, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.60)', textDecoration: 'none' }}
        >
          Give Again
        </Link>
      </div>
    </div>
  )
}

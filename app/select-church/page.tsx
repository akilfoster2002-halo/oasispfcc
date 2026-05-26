'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { LogOut, ArrowRight } from 'lucide-react'

interface Membership {
  id: string
  status: string
  role: string
  church: { id: string; name: string; slug: string }
}

function ChurchInitial({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
  return (
    <div style={{
      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #A88A35 0%, #C9A84C 100%)',
      fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em',
    }}>
      {initials}
    </div>
  )
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

  const wrapStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    background: '#050810',
    backgroundImage: 'radial-gradient(ellipse 70% 60% at 20% 0%, rgba(79,127,196,0.15) 0%, transparent 65%), radial-gradient(ellipse 55% 45% at 80% 100%, rgba(79,127,196,0.09) 0%, transparent 65%)',
    fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)',
    WebkitFontSmoothing: 'antialiased',
  }

  if (loading) {
    return (
      <div style={{ ...wrapStyle, gap: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(201,168,76,0.25)', borderTopColor: '#A88A35', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={wrapStyle}>
      {/* Brand */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 36 }}>
        <div style={{ position: 'relative' }}>
          <Image src="/Aquila Logo.png" width={38} height={38} alt="Aquila" />
          <div style={{ position: 'absolute', inset: -8, borderRadius: 20, background: 'radial-gradient(circle, rgba(201,168,76,0.20) 0%, transparent 70%)', pointerEvents: 'none' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui', fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em', color: 'rgba(255,255,255,0.94)', margin: 0, lineHeight: 1 }}>Aquila</p>
          <p style={{ fontSize: 11, color: 'rgba(201,168,76,0.52)', letterSpacing: '0.08em', fontWeight: 500, margin: '4px 0 0' }}>BY OASIS PFCC</p>
        </div>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.065)',
        borderRadius: 24,
        boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 24px 64px rgba(0,0,0,0.45)',
        padding: '28px 24px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.020em', color: 'rgba(255,255,255,0.94)', margin: '0 0 5px', fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui' }}>
            Choose a workspace
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
            Select which church to enter
          </p>
        </div>

        {memberships.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            You don&apos;t have access to any churches yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {memberships.map(m => (
              <button
                key={m.id}
                onClick={() => router.push(`/${m.church.slug}/dashboard`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 16, textAlign: 'left',
                  background: 'rgba(255,255,255,0.030)',
                  border: '1px solid rgba(255,255,255,0.065)',
                  cursor: 'pointer', width: '100%',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(201,168,76,0.08)'
                  e.currentTarget.style.borderColor = 'rgba(201,168,76,0.25)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.030)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.065)'
                }}
              >
                <ChurchInitial name={m.church.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.church.name}
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0', textTransform: 'capitalize' }}>
                    {m.role}
                  </p>
                </div>
                <ArrowRight style={{ width: 15, height: 15, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.055)', textAlign: 'center' }}>
          <button
            onClick={handleSignOut}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'rgba(255,255,255,0.28)',
              transition: 'color 0.12s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.28)')}
          >
            <LogOut style={{ width: 13, height: 13 }} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

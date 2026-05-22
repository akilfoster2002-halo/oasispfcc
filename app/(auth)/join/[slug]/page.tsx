import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface Church {
  id: string
  name: string
  slug: string
}

async function getChurch(slug: string): Promise<Church | null> {
  const base = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  try {
    const res = await fetch(`${base}/api/churches/${slug}`, { cache: 'no-store' })
    if (!res.ok) return null
    const { church } = await res.json()
    return church
  } catch {
    return null
  }
}

function ChurchInitial({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
  return (
    <div style={{
      width: 64, height: 64, borderRadius: 18,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #A88A35 0%, #C9A84C 100%)',
      fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em',
      boxShadow: '0 8px 24px rgba(201,168,76,0.45)',
    }}>
      {initials}
    </div>
  )
}

export default async function JoinLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const church = await getChurch(slug)

  if (!church) notFound()

  return (
    <div style={{
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
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'linear-gradient(145deg, rgba(255,255,255,0.052) 0%, rgba(255,255,255,0.018) 100%)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.065)',
        borderRadius: 24,
        boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset, 0 24px 64px rgba(0,0,0,0.45)',
        padding: '36px 28px',
      }}>
        {/* Church info */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <ChurchInitial name={church.name} />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui',
            fontSize: 22, fontWeight: 700, letterSpacing: '-0.020em',
            color: 'rgba(255,255,255,0.94)', margin: '0 0 6px',
          }}>
            {church.name}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: 0 }}>
            You&apos;ve been invited to join this church workspace on Aquila
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link
            href={`/join/${slug}/create`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
              background: 'linear-gradient(135deg, #A88A35 0%, #C9A84C 100%)',
              color: '#fff', textDecoration: 'none',
              boxShadow: '0 4px 18px rgba(201,168,76,0.40)',
            }}
          >
            Create an account
            <ArrowRight style={{ width: 15, height: 15 }} />
          </Link>

          <Link
            href={`/login?next=/join/${slug}/create`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 500,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: 'rgba(255,255,255,0.55)', textDecoration: 'none',
            }}
          >
            I already have an account
          </Link>
        </div>

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>
          By joining, you agree to this platform&apos;s terms of service.
        </p>
      </div>
    </div>
  )
}

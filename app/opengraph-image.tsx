import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { resolve } from 'path'

export const runtime = 'nodejs'
export const alt = 'Aquila — Modern church management platform'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const logoPath = resolve(process.cwd(), 'public', 'Aquila Logo.png')
  const logoData = readFileSync(logoPath)
  const logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#050810',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Ambient glow top-left */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            left: -80,
            width: 560,
            height: 420,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(79,142,247,0.18) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        {/* Ambient glow bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: -100,
            right: -60,
            width: 480,
            height: 360,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(79,142,247,0.12) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        {/* Subtle grid overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            display: 'flex',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
            zIndex: 1,
          }}
        >
          {/* Logo */}
          <img
            src={logoBase64}
            width={120}
            height={120}
            style={{ borderRadius: 28, marginBottom: 32 }}
          />

          {/* Wordmark */}
          <div
            style={{
              fontSize: 80,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.94)',
              letterSpacing: '-0.03em',
              lineHeight: 1,
              marginBottom: 20,
              fontFamily: 'system-ui',
            }}
          >
            Aquila
          </div>

          {/* Gold divider */}
          <div
            style={{
              width: 48,
              height: 2,
              background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)',
              borderRadius: 1,
              marginBottom: 20,
              display: 'flex',
            }}
          />

          {/* Tagline */}
          <div
            style={{
              fontSize: 28,
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: '-0.01em',
              fontFamily: 'system-ui',
              fontWeight: 400,
            }}
          >
            See your church clearly.
          </div>

          {/* Sub-tagline */}
          <div
            style={{
              marginTop: 14,
              fontSize: 18,
              color: 'rgba(201,168,76,0.65)',
              letterSpacing: '0.06em',
              fontFamily: 'system-ui',
              fontWeight: 500,
              textTransform: 'uppercase',
            }}
          >
            BY OASIS PFCC
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}

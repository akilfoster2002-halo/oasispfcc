'use client'

import Link from 'next/link'
import { usePathname, useRouter, useParams } from 'next/navigation'
import {
  LayoutDashboard, Users, Layers, BarChart3,
  Heart, MessageSquare, LogOut, Settings,
  CheckSquare, UserPlus, CalendarDays, FileText, Home,
} from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useUserProfile } from '@/lib/use-user-profile'

const NAV = [
  { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: 'people',    label: 'People',    icon: Users },
  { path: 'groups',    label: 'Groups',    icon: Layers },
  { path: 'cells',     label: 'Cells',     icon: Home },
  { path: 'events',    label: 'Events',    icon: CalendarDays },
  { path: 'forms',     label: 'Forms',     icon: FileText },
  { path: 'reports',   label: 'Analytics', icon: BarChart3 },
  { path: 'giving',    label: 'Giving',    icon: Heart },
  { path: 'messaging', label: 'Messaging', icon: MessageSquare },
]

const ADMIN_NAV = [
  { path: 'settings/team',      label: 'Team & Invites', icon: UserPlus },
  { path: 'settings/users',     label: 'User Access',    icon: Settings },
  { path: 'settings/approvals', label: 'Approvals',      icon: CheckSquare },
]

/* ── Brand mark: lens / iris — represents clarity of vision ─────────────────── */
function AquilaMark() {
  return (
    <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="mark-bg" cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="1"/>
            <stop offset="100%" stopColor="#3730a3" stopOpacity="1"/>
          </radialGradient>
          <radialGradient id="mark-iris" cx="40%" cy="38%" r="65%">
            <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.95"/>
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.85"/>
          </radialGradient>
          <filter id="mark-glow">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>
        {/* Outer shell */}
        <rect width="32" height="32" rx="9" fill="url(#mark-bg)"/>
        {/* Top highlight — frosted edge */}
        <rect x="0" y="0" width="32" height="14" rx="9" fill="rgba(255,255,255,0.10)"/>
        <rect x="0" y="7" width="32" height="7" fill="rgba(255,255,255,0)" />
        {/* Iris ring */}
        <circle cx="16" cy="16" r="7" stroke="rgba(255,255,255,0.20)" strokeWidth="1"/>
        {/* Core dot */}
        <circle cx="16" cy="16" r="4" fill="url(#mark-iris)" filter="url(#mark-glow)"/>
        {/* Specular glint */}
        <circle cx="13.5" cy="13.5" r="1.2" fill="rgba(255,255,255,0.55)"/>
      </svg>
    </div>
  )
}

/* ── Nav item ─────────────────────────────────────────────────────────────────── */
function NavItem({
  href, label, icon: Icon, active, small = false,
}: {
  href: string; label: string; icon: React.ElementType; active: boolean; small?: boolean
}) {
  const baseColor   = 'rgba(255,255,255,0.36)'
  const activeColor = 'rgba(255,255,255,0.92)'
  const hoverColor  = 'rgba(255,255,255,0.68)'

  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: small ? '6px 10px' : '7px 10px',
        borderRadius: 10,
        color: active ? activeColor : baseColor,
        background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
        fontSize: small ? 12 : 13,
        fontWeight: active ? 500 : 400,
        letterSpacing: '-0.006em',
        textDecoration: 'none',
        transition: 'color 0.12s ease, background 0.12s ease',
      }}
      onMouseEnter={e => {
        if (!active) {
          const el = e.currentTarget as HTMLElement
          el.style.color = hoverColor
          el.style.background = 'rgba(255,255,255,0.042)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          const el = e.currentTarget as HTMLElement
          el.style.color = baseColor
          el.style.background = 'transparent'
        }
      }}
    >
      <Icon style={{
        width: small ? 13 : 14,
        height: small ? 13 : 14,
        flexShrink: 0,
        color: active ? '#818cf8' : 'inherit',
        opacity: active ? 1 : 0.65,
        transition: 'color 0.12s ease',
      }}/>
      <span style={{ flex: 1 }}>{label}</span>
      {active && (
        <span style={{
          width: 4, height: 4,
          borderRadius: '50%',
          background: '#818cf8',
          boxShadow: '0 0 6px rgba(129,140,248,0.90)',
          flexShrink: 0,
        }}/>
      )}
    </Link>
  )
}

/* ── Sidebar ──────────────────────────────────────────────────────────────────── */
export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const params   = useParams()
  const { isMaster } = useUserProfile()
  const slug = (params?.slug as string) ?? pathname.split('/')[1] ?? ''

  async function handleSignOut() {
    await getSupabaseBrowser().auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className="hidden md:flex fixed inset-y-0 left-0 flex-col z-50"
      style={{
        width: 220,
        background: 'linear-gradient(180deg, rgba(5,8,16,0.980) 0%, rgba(4,6,14,0.995) 100%)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        borderRight: '1px solid rgba(255,255,255,0.052)',
        /* Subtle inner glow on the right edge */
        boxShadow: '1px 0 0 rgba(255,255,255,0.028)',
      }}
    >
      {/* ── Brand ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        height: 58,
        padding: '0 14px',
        borderBottom: '1px solid rgba(255,255,255,0.042)',
        flexShrink: 0,
      }}>
        <AquilaMark />
        <div style={{ minWidth: 0 }}>
          <p style={{
            fontFamily: 'var(--font-display), var(--font-geist-sans), system-ui',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '-0.025em',
            color: 'rgba(255,255,255,0.94)',
            lineHeight: 1,
            margin: 0,
          }}>
            Aquila
          </p>
          <p style={{
            fontSize: 10,
            marginTop: 4,
            color: 'rgba(129,140,248,0.52)',
            letterSpacing: '0.06em',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            margin: '4px 0 0',
          }}>
            {slug.toUpperCase() || 'PLATFORM'}
          </p>
        </div>
      </div>

      {/* ── Main nav ───────────────────────────────────────────────────────── */}
      <nav style={{
        flex: 1,
        padding: '12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        overflowY: 'auto',
      }}>
        {NAV.map(({ path, label, icon }) => {
          const href = `/${slug}/${path}`
          return (
            <NavItem
              key={path}
              href={href}
              label={label}
              icon={icon}
              active={pathname === href || pathname.startsWith(href + '/')}
            />
          )
        })}
      </nav>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 8px 14px',
        borderTop: '1px solid rgba(255,255,255,0.042)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        flexShrink: 0,
      }}>
        {isMaster && ADMIN_NAV.map(({ path, label, icon }) => {
          const href = `/${slug}/${path}`
          return (
            <NavItem
              key={path}
              href={href}
              label={label}
              icon={icon}
              active={pathname.startsWith(href)}
              small
            />
          )
        })}

        <button
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '6px 10px',
            borderRadius: 10,
            color: 'rgba(255,255,255,0.26)',
            background: 'transparent',
            border: 'none',
            fontSize: 12,
            fontWeight: 400,
            letterSpacing: '-0.006em',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'color 0.12s ease, background 0.12s ease',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.color = 'rgba(255,255,255,0.55)'
            el.style.background = 'rgba(255,255,255,0.038)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.color = 'rgba(255,255,255,0.26)'
            el.style.background = 'transparent'
          }}
        >
          <LogOut style={{ width: 13, height: 13, flexShrink: 0, opacity: 0.55 }}/>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}

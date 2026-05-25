'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useParams } from 'next/navigation'
import {
  LayoutDashboard, Users, Layers, BarChart3,
  Heart, MessageSquare, LogOut, Settings,
  CheckSquare, UserPlus, CalendarDays, FileText, Home, Radio,
} from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useUserProfile } from '@/lib/use-user-profile'

// ── Navigation manifest ────────────────────────────────────────────────────────

const CORE_NAV = [
  { path: 'dashboard', label: 'Church Agent', icon: LayoutDashboard },
  { path: 'people',    label: 'People',    icon: Users },
  { path: 'groups',    label: 'Groups',    icon: Layers },
  { path: 'cells',     label: 'Cells',     icon: Home },
  { path: 'events',    label: 'Events',    icon: CalendarDays },
  { path: 'services',  label: 'Services',  icon: Radio },
]

const TOOLS_NAV = [
  { path: 'forms',     label: 'Forms',     icon: FileText },
  { path: 'reports',   label: 'Analytics', icon: BarChart3 },
  { path: 'giving',    label: 'Giving',    icon: Heart },
  { path: 'messaging', label: 'Messaging', icon: MessageSquare },
]

const ADMIN_NAV = [
  { path: 'settings/team',      label: 'Team',      icon: UserPlus },
  { path: 'settings/users',     label: 'Access',    icon: Settings },
  { path: 'settings/approvals', label: 'Approvals', icon: CheckSquare },
]

// ── Brand mark ─────────────────────────────────────────────────────────────────

function AquilaMark() {
  return (
    <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
      <Image
        src="/Aquila Logo.png"
        alt="Aquila"
        width={32}
        height={32}
        style={{ objectFit: 'contain', width: 32, height: 32 }}
        priority
      />
    </div>
  )
}

// ── Section label ──────────────────────────────────────────────────────────────

function NavSection({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 12px 4px',
    }}>
      <span style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.13em',
        textTransform: 'uppercase',
        color: 'rgba(201,168,76,0.38)',
      }}>{label}</span>
      <div style={{
        flex: 1,
        height: 1,
        background: 'linear-gradient(90deg, rgba(201,168,76,0.15) 0%, transparent 100%)',
      }}/>
    </div>
  )
}

// ── Nav item ───────────────────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  small = false,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  small?: boolean
}) {
  return (
    <Link
      href={href}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: small ? '5px 12px' : '6px 12px',
        marginLeft: 8,
        marginRight: 8,
        borderRadius: 9,
        color: active ? 'rgba(255,248,225,0.92)' : 'rgba(255,255,255,0.34)',
        background: active
          ? 'linear-gradient(135deg, rgba(201,168,76,0.09) 0%, rgba(201,168,76,0.04) 100%)'
          : 'transparent',
        fontSize: small ? 12 : 13,
        fontWeight: active ? 500 : 400,
        letterSpacing: '-0.007em',
        textDecoration: 'none',
        transition: 'color 140ms ease, background 140ms ease',
        borderLeft: active ? '2px solid rgba(201,168,76,0.55)' : '2px solid transparent',
        borderRight: '2px solid transparent',
      }}
      onMouseEnter={e => {
        if (!active) {
          const el = e.currentTarget as HTMLElement
          el.style.color = 'rgba(255,248,225,0.62)'
          el.style.background = 'rgba(255,248,225,0.04)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          const el = e.currentTarget as HTMLElement
          el.style.color = 'rgba(255,255,255,0.34)'
          el.style.background = 'transparent'
        }
      }}
    >
      {/* Active gold indicator bar */}
      {active && (
        <div style={{
          position: 'absolute',
          left: -1,
          top: '20%',
          bottom: '20%',
          width: 2,
          borderRadius: 99,
          background: 'linear-gradient(180deg, #DDB95A 0%, #C9A84C 100%)',
          boxShadow: '0 0 8px rgba(201,168,76,0.60)',
        }}/>
      )}

      <Icon style={{
        width: small ? 13 : 14,
        height: small ? 13 : 14,
        flexShrink: 0,
        color: active ? '#C9A84C' : 'inherit',
        opacity: active ? 1 : 0.55,
        transition: 'color 140ms ease, opacity 140ms ease',
      }}/>

      <span style={{ flex: 1 }}>{label}</span>
    </Link>
  )
}

// ── Sidebar ─────────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname   = usePathname()
  const router     = useRouter()
  const params     = useParams()
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
        width: 228,
        /* Obsidian depth — warmer than pure black */
        background: 'linear-gradient(180deg, #0A0B14 0%, #07080F 60%, #06070D 100%)',
        backdropFilter: 'blur(48px) saturate(160%)',
        WebkitBackdropFilter: 'blur(48px) saturate(160%)',
        borderRight: '1px solid rgba(255,252,245,0.055)',
        /* Subtle inner warmth on right edge — the glow of the platform within */
        boxShadow:
          '1px 0 0 rgba(201,168,76,0.06), ' +
          'inset -1px 0 20px rgba(201,168,76,0.015)',
      }}
    >
      {/* ── Brand ───────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: 64,
        padding: '0 16px',
        borderBottom: '1px solid rgba(255,252,245,0.048)',
        flexShrink: 0,
        /* Subtle marble-warm top highlight */
        background: 'linear-gradient(180deg, rgba(255,252,245,0.025) 0%, transparent 100%)',
      }}>
        <AquilaMark />

        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Wordmark — Cormorant Garamond, weight 300, classical */}
          <p style={{
            fontFamily: 'var(--font-cormorant, "Cormorant Garamond"), Georgia, serif',
            fontSize: 20,
            fontWeight: 300,
            letterSpacing: '0.04em',
            color: 'rgba(255,248,225,0.94)',
            lineHeight: 1,
            margin: 0,
          }}>
            Aquila
          </p>
          {/* Church identifier — spaced caps, muted gold */}
          <p style={{
            fontSize: 9,
            marginTop: 5,
            color: 'rgba(201,168,76,0.45)',
            letterSpacing: '0.12em',
            fontWeight: 600,
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            margin: '5px 0 0',
          }}>
            {slug ? slug.replace(/-/g, ' ') : 'Platform'}
          </p>
        </div>
      </div>

      {/* ── Main navigation ─────────────────────────────────────────────────── */}
      <nav style={{
        flex: 1,
        paddingTop: 8,
        paddingBottom: 8,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}>
        <NavSection label="Core" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 4 }}>
          {CORE_NAV.map(({ path, label, icon }) => {
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
        </div>

        {/* Thin gold-tinted rule between groups */}
        <div style={{
          margin: '6px 16px',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.12) 40%, rgba(201,168,76,0.12) 60%, transparent)',
        }}/>

        <NavSection label="Tools" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {TOOLS_NAV.map(({ path, label, icon }) => {
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
        </div>
      </nav>

      {/* ── Footer — admin + sign out ────────────────────────────────────────── */}
      <div style={{
        paddingTop: 8,
        paddingBottom: 16,
        borderTop: '1px solid rgba(255,252,245,0.042)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        /* Subtle warm glow rising from footer */
        background: 'linear-gradient(0deg, rgba(201,168,76,0.012) 0%, transparent 100%)',
      }}>
        {isMaster && (
          <>
            <NavSection label="Admin" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 6 }}>
              {ADMIN_NAV.map(({ path, label, icon }) => {
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
            </div>
            <div style={{
              margin: '4px 16px 8px',
              height: 1,
              background: 'rgba(255,252,245,0.038)',
            }}/>
          </>
        )}

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            marginLeft: 8,
            marginRight: 8,
            padding: '5px 12px',
            borderRadius: 9,
            color: 'rgba(255,255,255,0.22)',
            background: 'transparent',
            border: 'none',
            fontSize: 12,
            fontWeight: 400,
            letterSpacing: '-0.006em',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'color 140ms ease, background 140ms ease',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.color = 'rgba(241,117,117,0.70)'
            el.style.background = 'rgba(241,117,117,0.06)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.color = 'rgba(255,255,255,0.22)'
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

'use client'

import Link from 'next/link'
import { usePathname, useRouter, useParams } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Layers,
  BarChart3,
  Heart,
  MessageSquare,
  Church,
  LogOut,
  Settings,
  CheckSquare,
} from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useUserProfile } from '@/lib/use-user-profile'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams()
  const { isMaster } = useUserProfile()

  // Derive slug from URL params or first path segment
  const slug = (params?.slug as string) ?? pathname.split('/')[1] ?? ''

  const navItems = [
    { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: 'people',    label: 'People',    icon: Users },
    { path: 'groups',    label: 'Groups',    icon: Layers },
    { path: 'reports',   label: 'Analytics', icon: BarChart3 },
    { path: 'giving',    label: 'Giving',    icon: Heart },
    { path: 'messaging', label: 'Messaging', icon: MessageSquare },
  ]

  async function handleSignOut() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className="hidden md:flex fixed inset-y-0 left-0 w-56 flex-col z-50"
      style={{
        background: 'linear-gradient(180deg, rgba(10,14,35,0.95) 0%, rgba(8,12,26,0.98) 100%)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-5 h-16 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 glow-pulse"
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
            boxShadow: '0 0 16px rgba(129,140,248,0.40)',
          }}
        >
          <Church className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate" style={{ color: 'rgba(255,255,255,0.92)' }}>
            Church-Link
          </p>
          <p className="text-[10px] leading-tight font-medium tracking-wide" style={{ color: 'rgba(129,140,248,0.70)' }}>
            {slug || 'Platform'}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p
          className="px-3 mb-3 text-[9px] font-bold uppercase tracking-[0.15em]"
          style={{ color: 'rgba(255,255,255,0.22)' }}
        >
          Navigation
        </p>
        {navItems.map(({ path, label, icon: Icon }) => {
          const href = `/${slug}/${path}`
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={path}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group"
              style={{
                color: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.42)',
                background: active
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.20) 0%, rgba(129,140,248,0.10) 100%)'
                  : 'transparent',
                border: active ? '1px solid rgba(129,140,248,0.20)' : '1px solid transparent',
                boxShadow: active ? '0 4px 16px rgba(99,102,241,0.15)' : 'none',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.80)'
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.42)'
                  ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                }
              }}
            >
              <Icon
                className="w-4 h-4 shrink-0 transition-colors"
                style={{ color: active ? '#818cf8' : 'inherit' }}
              />
              <span className="flex-1">{label}</span>
              {active && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 0 6px rgba(129,140,248,0.80)' }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-3 py-4 shrink-0 space-y-1"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        {isMaster && (
          <>
            {[
              { path: 'settings/users',     label: 'User Access',  Icon: Settings },
              { path: 'settings/approvals', label: 'Approvals',    Icon: CheckSquare },
            ].map(({ path, label, Icon }) => {
              const href = `/${slug}/${path}`
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={path}
                  href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                  style={{
                    color: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)',
                    background: active
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.20) 0%, rgba(129,140,248,0.10) 100%)'
                      : 'transparent',
                    border: active ? '1px solid rgba(129,140,248,0.20)' : '1px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.70)'
                      ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'
                      ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                    }
                  }}
                >
                  <Icon className="w-4 h-4 shrink-0" style={{ color: active ? '#818cf8' : 'inherit' }} />
                  <span>{label}</span>
                </Link>
              )
            })}
          </>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.70)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign out</span>
        </button>
        <p className="px-3 text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
          © 2026 Church-Link
        </p>
      </div>
    </aside>
  )
}

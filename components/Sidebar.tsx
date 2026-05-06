'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Layers,
  BarChart3,
  Heart,
  MessageSquare,
  Church,
} from 'lucide-react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/people', label: 'People', icon: Users },
  { href: '/groups', label: 'Groups', icon: Layers },
  { href: '/reports', label: 'Analytics', icon: BarChart3 },
  { href: '/giving', label: 'Giving', icon: Heart },
  { href: '/messaging', label: 'Messaging', icon: MessageSquare },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-56 flex-col z-50"
      style={{ backgroundColor: '#1C2333' }}>

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#4068E2' }}>
          <Church className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold leading-tight truncate">Oasis PFCC</p>
          <p className="text-xs leading-tight" style={{ color: '#5D7090' }}>Church Management</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: '#4A5568' }}>
          Menu
        </p>
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                color: active ? '#FFFFFF' : '#8B96A8',
                backgroundColor: active ? 'rgba(64, 104, 226, 0.15)' : 'transparent',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = '#FFFFFF'
                  ;(e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = '#8B96A8'
                  ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                }
              }}
            >
              <Icon
                className="w-4 h-4 shrink-0"
                style={{ color: active ? '#4068E2' : 'inherit' }}
              />
              <span className="flex-1">{label}</span>
              {active && (
                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: '#4068E2' }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs" style={{ color: '#4A5568' }}>© 2026 Oasis PFCC</p>
      </div>
    </aside>
  )
}

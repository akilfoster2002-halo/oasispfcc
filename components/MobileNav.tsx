'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Layers, BarChart3, MessageSquare } from 'lucide-react'

const items = [
  { href: '/', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/people', label: 'People', icon: Users },
  { href: '/groups', label: 'Groups', icon: Layers },
  { href: '/reports', label: 'Analytics', icon: BarChart3 },
  { href: '/messaging', label: 'Messages', icon: MessageSquare },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'linear-gradient(180deg, rgba(8,12,26,0.92) 0%, rgba(10,14,35,0.98) 100%)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="flex items-stretch h-16">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-all duration-200"
              style={{ color: active ? '#818cf8' : 'rgba(255,255,255,0.35)' }}
            >
              <div
                className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200"
                style={{
                  background: active ? 'rgba(129,140,248,0.15)' : 'transparent',
                  border: active ? '1px solid rgba(129,140,248,0.25)' : '1px solid transparent',
                }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span style={{ color: active ? '#818cf8' : 'rgba(255,255,255,0.35)' }}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
